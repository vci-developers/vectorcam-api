import { FastifyRequest, FastifyReply } from 'fastify';
import { formatSessionResponse, getPaginationParams, handleError } from './common';
import { Session } from '../../db/models';

export const schema = {
  tags: ['Sessions'],
  description: 'Get paginated list of sessions',
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'string' },
      size: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        totalItems: { type: 'number' },
        totalPages: { type: 'number' },
        currentPage: { type: 'number' },
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sessionId: { type: 'number' },
              frontendId: { type: ['number', 'null'] },
              houseNumber: { type: ['string', 'null'] },
              collectorTitle: { type: ['string', 'null'] },
              collectorName: { type: ['string', 'null'] },
              collectionDate: { type: ['number', 'null'] },
              collectionMethod: { type: ['string', 'null'] },
              specimenCondition: { type: ['string', 'null'] },
              createdAt: { type: 'number' },
              completedAt: { type: ['number', 'null'] },
              submittedAt: { type: ['number', 'null'] },
              notes: { type: ['string', 'null'] },
              siteId: { type: 'number' },
              deviceId: { type: 'number' }
            }
          }
        }
      }
    },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export async function getSessionPaginated(
  request: FastifyRequest<{ Querystring: { page?: string; size?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { page, size, offset } = getPaginationParams(request.query);

    const { count, rows } = await Session.findAndCountAll({
      limit: size,
      offset,
      order: [['createdAt', 'DESC']],
    });

    reply.send({
      totalItems: count,
      totalPages: Math.ceil(count / size),
      currentPage: page,
      sessions: rows.map(session => formatSessionResponse(session)),
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to get sessions');
  }
} 