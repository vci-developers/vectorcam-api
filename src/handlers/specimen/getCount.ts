import { FastifyRequest, FastifyReply } from 'fastify';
import { Specimen, Session, Site, SpecimenImage } from '../../db/models';
import { Op, QueryTypes } from 'sequelize';
import sequelize from '../../db/index';

interface QueryParams {
  from?: string;
  to?: string;
  district?: string;
}

export const schema = {
  tags: ['Specimens'],
  querystring: {
    type: 'object',
    properties: {
      from: { 
        type: 'string', 
        format: 'date', 
        description: 'Filter specimens from sessions with collection date from this date (YYYY-MM-DD)' 
      },
      to: { 
        type: 'string', 
        format: 'date', 
        description: 'Filter specimens from sessions with collection date to this date (YYYY-MM-DD)' 
      },
      district: {
        type: 'string',
        description: 'Filter specimens by district name'
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
                  district: { type: 'string', nullable: true },
                  subCounty: { type: 'string', nullable: true },
                  parish: { type: 'string', nullable: true },
                  villageName: { type: 'string', nullable: true },
                  houseNumber: { type: 'string' },
                  healthCenter: { type: 'string', nullable: true }
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
    const { from, to, district } = request.query;

    // Validate date range
    if (from && to && new Date(from) > new Date(to)) {
      return reply.code(400).send({ error: 'From date must be before or equal to to date' });
    }

    // Build session date filter
    const sessionWhere: any = {};
    if (from || to) {
      sessionWhere.collectionDate = {};
      if (from) {
        sessionWhere.collectionDate[Op.gte] = new Date(from);
      }
      if (to) {
        // Add one day to include the entire "to" date
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        sessionWhere.collectionDate[Op.lt] = toDate;
      }
    }

    // Apply site access restrictions
    const siteAccess = request.siteAccess;
    if (!siteAccess?.canRead) {
      return reply.code(403).send({ error: 'Forbidden: Insufficient permissions to access specimen data' });
    }

    // Build site restrictions based on user access and district filter
    const siteWhere: any = {};
    if (siteAccess.userSites.length > 0) {
      // User has limited site access, restrict to their sites
      siteWhere.id = {
        [Op.in]: siteAccess.userSites
      };
    }
    
    // Add district filter if provided
    if (district) {
      siteWhere.district = district;
    }
    
    // Get site IDs that match the filters
    let filteredSiteIds: number[] = [];
    if (district || siteAccess.userSites.length > 0) {
      const sites = await Site.findAll({
        where: siteWhere,
        attributes: ['id']
      });
      filteredSiteIds = sites.map(site => site.id);
      
      // If no sites match the filters, return empty result
      if (filteredSiteIds.length === 0) {
        return reply.send({
          message: 'Specimen counts retrieved successfully',
          columns: [],
          data: []
        });
      }
    }

    // Use raw SQL query for better performance with grouping
    const query = `
      SELECT 
        s.id as siteId,
        s.district,
        s.sub_county as subCounty,
        s.parish,
        s.village_name as villageName,
        s.house_number as houseNumber,
        s.health_center as healthCenter,
        si.species,
        si.sex,
        si.abdomen_status as abdomenStatus,
        COUNT(sp.id) as count
      FROM specimens sp
      INNER JOIN sessions sess ON sp.session_id = sess.id
      INNER JOIN sites s ON sess.site_id = s.id
      LEFT JOIN specimen_images si ON sp.thumbnail_image_id = si.id
      WHERE 1=1
        ${filteredSiteIds.length > 0 ? `AND s.id IN (${filteredSiteIds.join(',')})` : ''}
        ${from ? `AND sess.collection_date >= :fromDate` : ''}
        ${to ? `AND sess.collection_date < :toDate` : ''}
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
    if (from) {
      replacements.fromDate = new Date(from);
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      replacements.toDate = toDate;
    }

    const results = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT
    }) as any[];

    // Helper function to create column name from combination
    const createColumnName = (species: string | null, sex: string | null, abdomenStatus: string | null): string => {
      const parts = [
        species || 'Unknown',
        sex || 'Unknown', 
        abdomenStatus || 'Unknown'
      ];
      return parts.join(' ');
    };

    // Collect all unique combinations for columns
    const uniqueColumns = new Set<string>();

    // Group results by site
    const groupedBySite = new Map<number, {
      siteId: number;
      siteInfo: {
        district: string | null;
        subCounty: string | null;
        parish: string | null;
        villageName: string | null;
        houseNumber: string;
        healthCenter: string | null;
      };
      counts: Array<{
        species: string | null;
        sex: string | null;
        abdomenStatus: string | null;
        count: number;
        columnName: string;
      }>;
      totalSpecimens: number;
    }>();

    for (const row of results) {
      const siteId = Number(row.siteId);
      const columnName = createColumnName(row.species, row.sex, row.abdomenStatus);
      
      // Add to unique columns set
      uniqueColumns.add(columnName);
      
      if (!groupedBySite.has(siteId)) {
        groupedBySite.set(siteId, {
          siteId,
          siteInfo: {
            district: row.district,
            subCounty: row.subCounty,
            parish: row.parish,
            villageName: row.villageName,
            houseNumber: row.houseNumber,
            healthCenter: row.healthCenter
          },
          counts: [],
          totalSpecimens: 0
        });
      }

      const siteData = groupedBySite.get(siteId)!;
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
