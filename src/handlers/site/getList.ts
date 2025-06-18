import { FastifyRequest, FastifyReply } from 'fastify';
import { Site } from '../../db/models';
import { formatSiteResponse } from './common';
import { Op, Order } from 'sequelize';

export const schema = {
  tags: ['Sites'],
  querystring: {
    type: 'object',
    properties: {
      programId: { type: 'number', description: 'Filter by program ID' },
      district: { type: 'string', description: 'Filter by district (partial match)' },
      subCounty: { type: 'string', description: 'Filter by sub county (partial match)' },
      parish: { type: 'string', description: 'Filter by parish (partial match)' },
      sentinelSite: { type: 'string', description: 'Filter by sentinel site (partial match)' },
      healthCenter: { type: 'string', description: 'Filter by health center (partial match)' },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20, description: 'Number of items per page' },
      offset: { type: 'number', minimum: 0, default: 0, description: 'Number of items to skip' },
      sortBy: { type: 'string', enum: ['id', 'district', 'subCounty', 'parish', 'sentinelSite', 'healthCenter'], default: 'id', description: 'Field to sort by' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc', description: 'Sort order' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        sites: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              siteId: { type: 'number' },
              programId: { type: 'number' },
              district: { type: 'string', nullable: true },
              subCounty: { type: 'string', nullable: true },
              parish: { type: 'string', nullable: true },
              sentinelSite: { type: 'string', nullable: true },
              healthCenter: { type: 'string', nullable: true }
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
  programId?: number;
  district?: string;
  subCounty?: string;
  parish?: string;
  sentinelSite?: string;
  healthCenter?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'id' | 'district' | 'subCounty' | 'parish' | 'sentinelSite' | 'healthCenter';
  sortOrder?: 'asc' | 'desc';
}

export async function getSiteList(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    const {
      programId,
      district,
      subCounty,
      parish,
      sentinelSite,
      healthCenter,
      limit = 20,
      offset = 0,
      sortBy = 'id',
      sortOrder = 'asc'
    } = request.query;

    // Build where clause
    const whereClause: any = {};
    if (programId) {
      whereClause.programId = programId;
    }
    if (district) {
      whereClause.district = {
        [Op.iLike]: `%${district}%`
      };
    }
    if (subCounty) {
      whereClause.subCounty = {
        [Op.iLike]: `%${subCounty}%`
      };
    }
    if (parish) {
      whereClause.parish = {
        [Op.iLike]: `%${parish}%`
      };
    }
    if (sentinelSite) {
      whereClause.sentinelSite = {
        [Op.iLike]: `%${sentinelSite}%`
      };
    }
    if (healthCenter) {
      whereClause.healthCenter = {
        [Op.iLike]: `%${healthCenter}%`
      };
    }

    // Build order clause
    const orderClause: Order = [[sortBy, sortOrder.toUpperCase()]];

    // Get total count
    const total = await Site.count({ where: whereClause });

    // Get sites with pagination
    const sites = await Site.findAll({
      where: whereClause,
      order: orderClause,
      limit,
      offset
    });

    // Format response
    const formattedSites = sites.map(site => formatSiteResponse(site));

    return reply.code(200).send({
      sites: formattedSites,
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