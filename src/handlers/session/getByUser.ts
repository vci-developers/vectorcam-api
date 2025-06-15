import { FastifyRequest, FastifyReply } from 'fastify';
import { handleError } from './common';

export const schema = {
  tags: ['Sessions'],
  description: 'Get sessions by user',
  params: {
    type: 'object',
    properties: {
      user_id: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sessionId: { type: 'number' },
              frontendId: { type: 'number' },
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
              siteId: { type: 'number' }
            }
          }
        }
      }
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' }
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

export async function getSessionsByUser(
  request: FastifyRequest<{ Params: { user_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    // This will be implemented when user authentication is added
    reply.send({
      sessions: []
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to get sessions by user');
  }
} 