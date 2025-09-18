import { FastifyRequest, FastifyReply } from 'fastify';
import { findSiteById, formatSessionResponse, handleError } from './common';
import { Session } from '../../db/models';

export const schema = {
  tags: ['Sessions'],
  description: 'Get sessions by site',
  params: {
    type: 'object',
    properties: {
      site_id: { type: 'number' }
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
              type: { type: 'string', enum: ['SURVEILLANCE', 'DATA_COLLECTION'] }
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

export async function getSessionsBySite(
  request: FastifyRequest<{ Params: { site_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { site_id } = request.params;

    // Check if site exists
    const site = await findSiteById(site_id);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    // Get all sessions for this site
    const sessions = await Session.findAll({
      where: { siteId: site_id },
      order: [['createdAt', 'DESC']],
    });

    return reply.send({
      sessions: sessions.map(session => formatSessionResponse(session)),
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get sessions by site');
  }
} 