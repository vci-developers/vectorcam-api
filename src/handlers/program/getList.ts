import { FastifyRequest, FastifyReply } from 'fastify';
import { Program } from '../../db/models';
import { formatProgramResponse } from './common';
import { Op, Order } from 'sequelize';

export const schema = {
  tags: ['Programs'],
  querystring: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Filter by program name (partial match)' },
      country: { type: 'string', description: 'Filter by country (partial match)' },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20, description: 'Number of items per page' },
      offset: { type: 'number', minimum: 0, default: 0, description: 'Number of items to skip' },
      sortBy: { type: 'string', enum: ['id', 'name', 'country'], default: 'id', description: 'Field to sort by' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc', description: 'Sort order' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        programs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              programId: { type: 'number' },
              name: { type: 'string' },
              country: { type: 'string' }
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
  name?: string;
  country?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'id' | 'name' | 'country';
  sortOrder?: 'asc' | 'desc';
}

export async function getProgramList(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    const {
      name,
      country,
      limit = 20,
      offset = 0,
      sortBy = 'id',
      sortOrder = 'asc'
    } = request.query;

    // Build where clause
    const whereClause: any = {};
    if (name) {
      whereClause.name = {
        [Op.iLike]: `%${name}%`
      };
    }
    if (country) {
      whereClause.country = {
        [Op.iLike]: `%${country}%`
      };
    }

    // Build order clause
    const orderClause: Order = [[sortBy, sortOrder.toUpperCase()]];

    // Get total count
    const total = await Program.count({ where: whereClause });

    // Get programs with pagination
    const programs = await Program.findAll({
      where: whereClause,
      order: orderClause,
      limit,
      offset
    });

    // Format response
    const formattedPrograms = programs.map(program => formatProgramResponse(program));

    return reply.code(200).send({
      programs: formattedPrograms,
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