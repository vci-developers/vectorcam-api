import { FastifyRequest, FastifyReply } from 'fastify';
import { Specimen, Session, Site, Program } from '../../db/models';
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
      specimenId: { type: 'string', description: 'Filter by specimen ID (partial match)' },
      species: { type: 'string', description: 'Filter by species (partial match)' },
      sex: { type: 'string', description: 'Filter by sex (exact match)' },
      abdomenStatus: { type: 'string', description: 'Filter by abdomen status (exact match)' },
      hasImages: { type: 'boolean', description: 'Filter specimens that have images' },
      hasInference: { type: 'boolean', description: 'Filter specimens that have inference results' },
      dateFrom: { type: 'string', format: 'date', description: 'Filter specimens captured from this date (YYYY-MM-DD)' },
      dateTo: { type: 'string', format: 'date', description: 'Filter specimens captured to this date (YYYY-MM-DD)' },
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
              species: { type: 'string', nullable: true },
              sex: { type: 'string', nullable: true },
              abdomenStatus: { type: 'string', nullable: true },
              capturedAt: { type: 'number', nullable: true },
              thumbnailUrl: { type: 'string', nullable: true },
              thumbnailImageId: { type: 'number', nullable: true },
              images: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    url: { type: 'string' }
                  }
                }
              },
              inferenceResult: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'number' },
                  bboxTopLeftX: { type: 'number' },
                  bboxTopLeftY: { type: 'number' },
                  bboxWidth: { type: 'number' },
                  bboxHeight: { type: 'number' },
                  speciesProbabilities: { type: 'array', items: { type: 'number' } },
                  sexProbabilities: { type: 'array', items: { type: 'number' } },
                  abdomenStatusProbabilities: { type: 'array', items: { type: 'number' } }
                }
              },
              session: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  frontendId: { type: 'number' },
                  houseNumber: { type: 'string', nullable: true },
                  collectorName: { type: 'string', nullable: true }
                }
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
  specimenId?: string;
  species?: string;
  sex?: string;
  abdomenStatus?: string;
  hasImages?: boolean;
  hasInference?: boolean;
  dateFrom?: string;
  dateTo?: string;
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
      specimenId,
      species,
      sex,
      abdomenStatus,
      hasImages,
      hasInference,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0,
      sortBy = 'id',
      sortOrder = 'asc'
    } = request.query;

    // Build where clause
    const whereClause: any = {};
    if (sessionId) {
      whereClause.sessionId = sessionId;
    }
    if (specimenId) {
      whereClause.specimenId = {
        [Op.iLike]: `%${specimenId}%`
      };
    }
    if (species) {
      whereClause.species = {
        [Op.iLike]: `%${species}%`
      };
    }
    if (sex) {
      whereClause.sex = sex;
    }
    if (abdomenStatus) {
      whereClause.abdomenStatus = abdomenStatus;
    }

    // Handle date range filtering
    if (dateFrom || dateTo) {
      whereClause.capturedAt = {};
      if (dateFrom) {
        whereClause.capturedAt[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.capturedAt[Op.lte] = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    // Build include clause
    const includeClause: any[] = [
      {
        model: Session,
        as: 'session',
        attributes: ['id', 'frontendId', 'houseNumber', 'collectorName'],
        include: [
          {
            model: Site,
            as: 'site',
            attributes: ['id', 'district', 'subCounty', 'parish', 'sentinelSite', 'healthCenter']
          }
        ]
      }
    ];

    // Add site filter to session include if needed
    if (siteId) {
      includeClause[0].where = { siteId };
    }

    // Add program filter to site include if needed
    if (programId) {
      includeClause[0].include[0].where = { programId };
    }

    // Build order clause
    const orderClause: Order = [[sortBy, sortOrder.toUpperCase()]];

    // Get total count
    const total = await Specimen.count({
      where: whereClause,
      include: includeClause
    });

    // Get specimens with pagination
    const specimens = await Specimen.findAll({
      where: whereClause,
      include: includeClause,
      order: orderClause,
      limit,
      offset
    });

    // Format response
    const formattedSpecimens = await Promise.all(
      specimens.map(async (specimen) => {
        const specimenData = specimen.get({ plain: true }) as any;
        const formattedSpecimen = await formatSpecimenResponse(specimen);
        
        return {
          ...formattedSpecimen,
          session: specimenData.session ? {
            id: specimenData.session.id,
            frontendId: specimenData.session.frontendId,
            houseNumber: specimenData.session.houseNumber,
            collectorName: specimenData.session.collectorName
          } : null
        };
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