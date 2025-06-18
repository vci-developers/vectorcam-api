import { FastifyRequest, FastifyReply } from 'fastify';
import { Device, Program } from '../../db/models';
import { formatDeviceResponse } from './common';
import { Op, Order } from 'sequelize';

export const schema = {
  tags: ['Devices'],
  querystring: {
    type: 'object',
    properties: {
      programId: { type: 'number', description: 'Filter by program ID' },
      model: { type: 'string', description: 'Filter by device model (partial match)' },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20, description: 'Number of items per page' },
      offset: { type: 'number', minimum: 0, default: 0, description: 'Number of items to skip' },
      sortBy: { type: 'string', enum: ['id', 'model', 'registeredAt', 'programId'], default: 'id', description: 'Field to sort by' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc', description: 'Sort order' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        devices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              deviceId: { type: 'number' },
              model: { type: 'string' },
              registeredAt: { type: 'number' },
              programId: { type: 'number' },
              program: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  name: { type: 'string' }
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
  programId?: number;
  model?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'id' | 'model' | 'registeredAt' | 'programId';
  sortOrder?: 'asc' | 'desc';
}

export async function getDeviceList(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    const {
      programId,
      model,
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
    if (model) {
      whereClause.model = {
        [Op.iLike]: `%${model}%`
      };
    }

    // Build order clause
    const orderClause: Order = [[sortBy, sortOrder.toUpperCase()]];

    // Get total count
    const total = await Device.count({ where: whereClause });

    // Get devices with pagination
    const devices = await Device.findAll({
      where: whereClause,
      include: [
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'name']
        }
      ],
      order: orderClause,
      limit,
      offset
    });

    // Format response
    const formattedDevices = devices.map(device => {
      const deviceData = device.get({ plain: true }) as any;
      return {
        ...formatDeviceResponse(device),
        program: deviceData.program ? {
          id: deviceData.program.id,
          name: deviceData.program.name
        } : null
      };
    });

    return reply.code(200).send({
      devices: formattedDevices,
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