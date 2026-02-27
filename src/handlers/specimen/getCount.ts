import { FastifyRequest, FastifyReply } from 'fastify';
import { Specimen, Session, Site, SpecimenImage } from '../../db/models';
import { Op, QueryTypes, fn, col, where, literal } from 'sequelize';
import sequelize from '../../db/index';
import { formatSiteResponse } from '../site/common';

interface QueryParams {
  startDate?: string;
  endDate?: string;
  district?: string;
  sessionId?: string;
  sessionType?: string;
  locationTypeKey?: string;
  locationTypeValue?: string;
}

export const schema = {
  tags: ['Specimens'],
  querystring: {
    type: 'object',
    properties: {
      startDate: { 
        type: 'string', 
        format: 'date', 
        description: 'Filter specimens from sessions with collection date from this date (YYYY-MM-DD)' 
      },
      endDate: { 
        type: 'string', 
        format: 'date', 
        description: 'Filter specimens from sessions with collection date to this date (YYYY-MM-DD)' 
      },
      district: {
        type: 'string',
        description: 'Filter specimens by district name'
      },
      sessionId: {
        type: 'string',
        description: 'Filter specimens by session ID'
      },
      sessionType: {
        type: 'string',
        enum: ['SURVEILLANCE', 'DATA_COLLECTION', 'CALIBRATION', 'PRACTICE'],
        description: 'Filter specimens by session type'
      },
      locationTypeKey: {
        type: 'string',
        description: 'Filter by location type name key in location hierarchy'
      },
      locationTypeValue: {
        type: 'string',
        description: 'Filter by site name value for given location type key'
      },
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'All unique combinations of species, sex, and abdomenStatus as column names'
        },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              siteId: { type: 'number' },
              siteInfo: {
                type: 'object',
                properties: {
                  siteId: { type: 'number' },
                  programId: { type: 'number' },
                  locationTypeId: { type: ['number', 'null'] },
                  parentId: { type: ['number', 'null'] },
                  name: { type: 'string' },
                  district: { type: 'string', nullable: true },
                  subCounty: { type: 'string', nullable: true },
                  parish: { type: 'string', nullable: true },
                  villageName: { type: 'string', nullable: true },
                  houseNumber: { type: 'string' },
                  isActive: { type: 'boolean' },
                  hasData: { type: 'boolean' },
                  healthCenter: { type: 'string', nullable: true },
                  locationHierarchy: {
                    type: 'object',
                    additionalProperties: { type: 'string' }
                  }
                }
              },
              counts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    species: { type: 'string', nullable: true },
                    sex: { type: 'string', nullable: true },
                    abdomenStatus: { type: 'string', nullable: true },
                    count: { type: 'number' },
                    columnName: { type: 'string' }
                  }
                }
              },
              totalSpecimens: { type: 'number' }
            }
          }
        }
      }
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    },
    403: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export async function getSpecimenCount(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    const { startDate, endDate, district, sessionId, sessionType, locationTypeKey, locationTypeValue } = request.query;

    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return reply.code(400).send({ error: 'Start date must be before or equal to end date' });
    }

    // Build session date filter
    const sessionWhere: any = {};
    if (startDate || endDate) {
      sessionWhere.collectionDate = {};
      if (startDate) {
        sessionWhere.collectionDate[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        // Add one day to include the entire "endDate" date
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        sessionWhere.collectionDate[Op.lt] = endDateObj;
      }
    }

    // Apply site access restrictions
    const siteAccess = request.siteAccess;
    if (!siteAccess?.canRead) {
      return reply.code(403).send({ error: 'Forbidden: Insufficient permissions to access specimen data' });
    }

    // Build site restrictions based on user access and district filter
    const siteWhere: any = {};
    let hasSiteFilter = false;
    if (siteAccess.userSites.length > 0) {
      // User has limited site access, restrict to their sites
      siteWhere.id = {
        [Op.in]: siteAccess.userSites
      };
      hasSiteFilter = true;
    }
    
    // Add district filter if provided
    if (district) {
      siteWhere.district = district;
      hasSiteFilter = true;
    }

    // Add dynamic location type filter if provided
    if (locationTypeKey && locationTypeValue) {
      const escapedKey = locationTypeKey.replace(/["\\]/g, '\\$&');
      const jsonPath = literal(`'$."${escapedKey}"'`);
      siteWhere[Op.and] = [
        ...(siteWhere[Op.and] || []),
        where(
          fn('JSON_EXTRACT', fn('COALESCE', col('location_hierarchy'), '{}'), jsonPath),
          locationTypeValue
        ),
      ];
      hasSiteFilter = true;
    }
    
    // Get all sites that match the filters (to include all accessible sites in results)
    let filteredSiteIds: number[] = [];
    let allAccessibleSites: any[] = [];
    
    const siteAttributes = [
      'id',
      'programId',
      'locationTypeId',
      'parentId',
      'name',
      'district',
      'subCounty',
      'parish',
      'villageName',
      'houseNumber',
      'isActive',
      'healthCenter',
      'hasData',
      'locationHierarchy',
    ];

    const sites = await Site.findAll({
      where: hasSiteFilter ? siteWhere : undefined,
      attributes: siteAttributes,
    });

    const formattedSites = await Promise.all(sites.map(site => formatSiteResponse(site)));
    allAccessibleSites = formattedSites.map(site => ({ siteId: site.siteId, site }));
    filteredSiteIds = hasSiteFilter ? formattedSites.map(site => site.siteId) : [];

    // If filtering was requested but no sites matched, return empty
    if (hasSiteFilter && filteredSiteIds.length === 0) {
      return reply.send({
        message: 'Specimen counts retrieved successfully',
        columns: [],
        data: []
      });
    }

    // Use raw SQL query for better performance with grouping
    const query = `
      SELECT 
        s.id as siteId,
        si.species,
        si.sex,
        si.abdomen_status as abdomenStatus,
        COUNT(sp.id) as count
      FROM specimens sp
      INNER JOIN sessions sess ON sp.session_id = sess.id
      INNER JOIN sites s ON sess.site_id = s.id
      LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
      WHERE 1=1
        ${sessionType ? `AND sess.type = :sessionType` : ''}
        ${filteredSiteIds.length > 0 ? `AND s.id IN (${filteredSiteIds.join(',')})` : ''}
        ${sessionId ? `AND sess.id = :sessionId` : ''}
        ${startDate ? `AND sess.collection_date >= :startDate` : ''}
        ${endDate ? `AND sess.collection_date < :endDate` : ''}
      GROUP BY 
        s.id, 
        s.district, 
        s.sub_county, 
        s.parish, 
        s.village_name, 
        s.house_number, 
        s.health_center,
        si.species, 
        si.sex, 
        si.abdomen_status
      ORDER BY s.id, si.species, si.sex, si.abdomen_status
    `;

    const replacements: any = {};
    if (sessionId) {
      replacements.sessionId = sessionId;
    }
    if (sessionType) {
      replacements.sessionType = sessionType;
    }
    if (startDate) {
      replacements.startDate = new Date(startDate);
    }
    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
      replacements.endDate = endDateObj;
    }

    const results = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT
    }) as any[];

    // Helper function to create column name from combination
    const createColumnName = (species: string | null, sex: string | null, abdomenStatus: string | null): string => {
      const parts = [species, sex, abdomenStatus].filter(part => 
        part !== null && part !== '' && part.toLowerCase() !== 'unknown'
      );
      return parts.join(' ');
    };

    // Collect all unique combinations for columns
    const uniqueColumns = new Set<string>();

    // Initialize groupedBySite with all accessible sites
    const groupedBySite = new Map<number, {
      siteId: number;
      siteInfo: Record<string, any>;
      counts: Array<{
        species: string | null;
        sex: string | null;
        abdomenStatus: string | null;
        count: number;
        columnName: string;
      }>;
      totalSpecimens: number;
    }>();

    // Pre-populate with all accessible sites
    for (const { siteId, site } of allAccessibleSites) {
      groupedBySite.set(siteId, {
        siteId,
        siteInfo: site,
        counts: [],
        totalSpecimens: 0
      });
    }

    // Populate with specimen counts from query results
    for (const row of results) {
      const siteId = Number(row.siteId);
      const columnName = createColumnName(row.species, row.sex, row.abdomenStatus);
      
      // Add to unique columns set
      uniqueColumns.add(columnName);
      
      const siteData = groupedBySite.get(siteId);
      if (siteData) {
        const count = Number(row.count);
        
        siteData.counts.push({
          species: row.species,
          sex: row.sex,
          abdomenStatus: row.abdomenStatus,
          count,
          columnName
        });
        
        siteData.totalSpecimens += count;
      }
    }

    // Convert map to array and sort columns
    const data = Array.from(groupedBySite.values());
    const columns = Array.from(uniqueColumns).sort();

    return reply.send({
      message: 'Specimen counts retrieved successfully',
      columns,
      data
    });

  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ 
      error: 'Internal server error while retrieving specimen counts' 
    });
  }
}
