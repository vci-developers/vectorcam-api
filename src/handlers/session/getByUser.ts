import { FastifyRequest, FastifyReply } from 'fastify';
import { handleError } from './common';
import { SessionState } from '../../db/models/Session';

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
              frontendId: { type: 'string' },
              collectorTitle: { type: ['string', 'null'] },
              collectorName: { type: ['string', 'null'] },
              collectionDate: { type: ['number', 'null'] },
              collectionMethod: { type: ['string', 'null'] },
              specimenCondition: { type: ['string', 'null'] },
              createdAt: { type: ['number', 'null'] },
              completedAt: { type: ['number', 'null'] },
              submittedAt: { type: 'number' },
              notes: { type: ['string', 'null'] },
              siteId: { type: 'number' },
              deviceId: { type: 'number' },
              latitude: { type: ['number', 'null'] },
              longitude: { type: ['number', 'null'] },
              type: { type: 'string', enum: ['SURVEILLANCE', 'DATA_COLLECTION'] },
              collectorLastTrainedOn: { type: ['number', 'null'] },
              hardwareId: { type: ['string', 'null'] },
              expectedSpecimens: { type: 'number' },
              state: { type: 'string', enum: Object.values(SessionState) }
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
    return reply.send({
      sessions: []
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get sessions by user');
  }
} 