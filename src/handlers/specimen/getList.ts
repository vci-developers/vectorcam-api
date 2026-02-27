import { FastifyRequest, FastifyReply } from 'fastify';
import { Specimen, Session, Site, SpecimenImage } from '../../db/models';
import { formatSpecimenResponse } from './common';
import { Op, Order } from 'sequelize';

export const schema = {
  tags: ['Specimens'],
  querystring: {
    type: 'object',
    properties: {
      sessionId: { type: 'number', description: 'Filter by session ID' },
      siteId: { type: 'number', description: 'Filter by site ID' },
      programId: { type: 'number', description: 'Filter by program ID' },
      district: { type: 'string', description: 'Filter by district name' },
      specimenId: { type: 'string', description: 'Filter by specimen ID (partial match)' },
      shouldProcessFurther: { type: 'boolean', description: 'Filter by shouldProcessFurther flag' },
      hasImages: { type: 'boolean', description: 'Filter specimens that have images' },
      includeAllImages: { type: 'boolean', description: 'Include all images for each specimen (default: false, only thumbnail)' },
      species: { type: 'string', description: 'Filter by species from thumbnail image' },
      sex: { type: 'string', description: 'Filter by sex from thumbnail image' },
      abdomenStatus: { type: 'string', description: 'Filter by abdomen status from thumbnail image' },
      sessionType: { type: 'string', enum: ['SURVEILLANCE', 'DATA_COLLECTION', 'CALIBRATION', 'PRACTICE'], description: 'Filter by session type' },
      startDate: { type: 'string', format: 'date', description: 'Filter specimens by session collection date from this date (YYYY-MM-DD)' },
      endDate: { type: 'string', format: 'date', description: 'Filter specimens by session collection date to this date (YYYY-MM-DD)' },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20, description: 'Number of items per page' },
      offset: { type: 'number', minimum: 0, default: 0, description: 'Number of items to skip' },
      sortBy: { type: 'string', enum: ['id', 'specimenId', 'capturedAt', 'createdAt'], default: 'id', description: 'Field to sort by' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc', description: 'Sort order' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        specimens: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              specimenId: { type: 'string' },
              sessionId: { type: 'number' },
              thumbnailUrl: { type: 'string', nullable: true },
              thumbnailImageId: { type: 'number', nullable: true },
              shouldProcessFurther: { type: 'boolean' },
              expectedImages: { type: 'number' },
              images: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    url: { type: 'string' },
                    species: { type: ['string', 'null'] },
                    sex: { type: ['string', 'null'] },
                    abdomenStatus: { type: ['string', 'null'] },
                    capturedAt: { type: ['number', 'null'] },
                    submittedAt: { type: 'number' },
                    inferenceResult: {
                      anyOf: [
                        { type: 'null' },
                        {
                          type: 'object',
                          properties: {
                            id: { type: 'number' },
                            bboxTopLeftX: { type: 'number' },
                            bboxTopLeftY: { type: 'number' },
                            bboxWidth: { type: 'number' },
                            bboxHeight: { type: 'number' },
                            bboxConfidence: { type: 'number' },
                            bboxClassId: { type: 'number' },
                            speciesLogits: { type: 'array', items: { type: 'number' } },
                            sexLogits: { type: 'array', items: { type: 'number' } },
                            abdomenStatusLogits: { type: 'array', items: { type: 'number' } },
                            speciesInferenceDuration: { type: ['number', 'null'] },
                            sexInferenceDuration: { type: ['number', 'null'] },
                            abdomenStatusInferenceDuration: { type: ['number', 'null'] },
                            bboxDetectionDuration: { type: ['number', 'null'] }
                          }
                        }
                      ]
                    }
                  }
                }
              },
              thumbnailImage: {
                anyOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    properties: {
                      id: { type: 'number' },
                      url: { type: 'string' },
                      species: { type: ['string', 'null'] },
                      sex: { type: ['string', 'null'] },
                      abdomenStatus: { type: ['string', 'null'] },
                      capturedAt: { type: ['number', 'null'] },
                      submittedAt: { type: 'number' },
                      inferenceResult: {
                        anyOf: [
                          { type: 'null' },
                          {
                            type: 'object',
                            properties: {
                              id: { type: 'number' },
                              bboxTopLeftX: { type: 'number' },
                              bboxTopLeftY: { type: 'number' },
                              bboxWidth: { type: 'number' },
                              bboxHeight: { type: 'number' },
                              bboxConfidence: { type: 'number' },
                              bboxClassId: { type: 'number' },
                              speciesLogits: { type: 'array', items: { type: 'number' } },
                              sexLogits: { type: 'array', items: { type: 'number' } },
                              abdomenStatusLogits: { type: 'array', items: { type: 'number' } },
                              speciesInferenceDuration: { type: ['number', 'null'] },
                              sexInferenceDuration: { type: ['number', 'null'] },
                              abdomenStatusInferenceDuration: { type: ['number', 'null'] },
                              bboxDetectionDuration: { type: ['number', 'null'] }
                            }
                          }
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' },
        hasMore: { type: 'boolean' }
      }
    }
  }
};

interface QueryParams {
  sessionId?: number;
  siteId?: number;
  programId?: number;
  district?: string;
  specimenId?: string;
  shouldProcessFurther?: boolean;
  hasImages?: boolean;
  includeAllImages?: boolean;
  species?: string;
  sex?: string;
  abdomenStatus?: string;
  sessionType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'id' | 'specimenId' | 'capturedAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export async function getSpecimenList(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    const {
      sessionId,
      siteId,
      programId,
      district,
      specimenId,
      shouldProcessFurther,
      hasImages,
      includeAllImages,
      species,
      sex,
      abdomenStatus,
      sessionType,
      startDate,
      endDate,
      limit = 20,
      offset = 0,
      sortBy = 'id',
      sortOrder = 'asc'
    } = request.query;

    // Build where clause
    const whereClause: any = {};
    const include: any[] = [];
    if (sessionId) {
      whereClause.sessionId = sessionId;
    }
    if (specimenId) {
      whereClause.specimenId = {
        [Op.like]: `%${specimenId}%`
      };
    }
    if (shouldProcessFurther !== undefined) {
      whereClause.shouldProcessFurther = shouldProcessFurther;
    }

    // Apply site access restrictions first
    const siteAccess = request.siteAccess;
    const sessionInclude: any = {
      model: Session,
      as: 'session',
      required: true,
      where: {},
      include: []
    };

    // Build site restrictions based on user access
    const siteWhere: any = {};
    let accessibleSiteIds: number[] = [];
    
    if (siteAccess && siteAccess.userSites.length > 0) {
      // User has limited site access
      accessibleSiteIds = siteAccess.userSites;
    }
    
    // If district filter is provided, find sites in that district
    if (district) {
      const districtSiteWhere: any = { district };
      
      // If user has limited access, intersect with their accessible sites
      if (accessibleSiteIds.length > 0) {
        districtSiteWhere.id = { [Op.in]: accessibleSiteIds };
      }
      
      const districtSites = await Site.findAll({
        where: districtSiteWhere,
        attributes: ['id']
      });
      
      const districtSiteIds = districtSites.map(site => site.id);
      
      if (districtSiteIds.length === 0) {
        // No sites in this district that user has access to
        siteWhere.id = -1; // Return no results
      } else {
        siteWhere.id = { [Op.in]: districtSiteIds };
      }
    } else if (accessibleSiteIds.length > 0) {
      // No district filter, but user has limited access
      siteWhere.id = { [Op.in]: accessibleSiteIds };
    }

    // Add user-provided filters
    if (siteId) {
      if (accessibleSiteIds.length > 0) {
        // User has limited access - only allow if they have access to this site
        if (accessibleSiteIds.includes(siteId)) {
          siteWhere.id = siteId;
        } else {
          // User doesn't have access to this site - return empty result
          siteWhere.id = -1; // This will return no results
        }
      } else {
        // User has full access or admin/mobile token
        siteWhere.id = siteId;
      }
    }

    if (programId) {
      siteWhere.programId = programId;
    }

    // Handle date range filtering on session collection date
    if (startDate || endDate) {
      sessionInclude.where.collectionDate = {};
      if (startDate) {
        sessionInclude.where.collectionDate[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        sessionInclude.where.collectionDate[Op.lte] = new Date(endDate + 'T23:59:59.999Z');
      }
    }

    // Handle session type filtering
    if (sessionType) {
      sessionInclude.where.type = sessionType;
    }

    // Add site include with restrictions
    sessionInclude.include.push({
      model: Site,
      as: 'site',
      required: true,
      where: siteWhere
    });

    include.push(sessionInclude);

    // Filter by hasImages
    if (hasImages) {
      include.push({
        model: SpecimenImage,
        as: 'images',
        required: true,
        attributes: [],
      });
    }

    // Filter by species, sex, or abdomenStatus from thumbnail image
    if (species || sex || abdomenStatus) {
      const thumbnailWhere: any = {};
      if (species) {
        thumbnailWhere.species = species;
      }
      if (sex) {
        thumbnailWhere.sex = sex;
      }
      if (abdomenStatus) {
        thumbnailWhere.abdomenStatus = abdomenStatus;
      }
      
      include.push({
        model: SpecimenImage,
        as: 'thumbnailImage',
        required: true,
        where: thumbnailWhere,
        attributes: [],
      });
    }

    // Build order clause
    const orderClause: Order = [[sortBy, sortOrder.toUpperCase()]];

    const total = await Specimen.count({
      where: whereClause,
      include,
      distinct: true,
      col: 'id'
    });

    // Get specimens with pagination
    const specimens = await Specimen.findAll({
      where: whereClause,
      include,
      order: orderClause,
      limit,
      offset
    });

    // Format response
    const formattedSpecimens = await Promise.all(
      specimens.map(async (specimen) => {
        return await formatSpecimenResponse(specimen, includeAllImages || false);
      })
    );

    return reply.code(200).send({
      specimens: formattedSpecimens,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 