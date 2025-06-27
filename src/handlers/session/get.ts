import { FastifyRequest, FastifyReply } from 'fastify';
import { formatSessionResponse, handleError, findSession } from './common';
import { Session, Site, Device } from '../../db/models';

export const schema = {
  tags: ['Sessions'],
  description: 'Get session details by session_id (string: can be numeric or frontendId)',
  params: {
    type: 'object',
    properties: {
      session_id: { type: 'string' }
    },
    required: ['session_id']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        sessionId: { type: 'number' },
        frontendId: { type: 'string' },
        houseNumber: { type: ['string', 'null'] },
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
        site: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            district: { type: 'string', nullable: true },
            subCounty: { type: 'string', nullable: true },
            parish: { type: 'string', nullable: true },
            sentinelSite: { type: 'string', nullable: true },
            healthCenter: { type: 'string', nullable: true }
          }
        },
        device: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            model: { type: 'string' },
            registeredAt: { type: 'number' }
          }
        }
      }
    }
  }
};

export async function getSessionDetails(
  request: FastifyRequest<{ Params: { session_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;

    const include = [
      {
        model: Site,
        as: 'site',
        attributes: ['id', 'district', 'subCounty', 'parish', 'sentinelSite', 'healthCenter']
      },
      {
        model: Device,
        as: 'device',
        attributes: ['id', 'model', 'registeredAt']
      }
    ];

    const session = await findSession(session_id, include);

    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Format response with associations
    const sessionData = session.get({ plain: true }) as any;
    const response = {
      ...formatSessionResponse(session),
      site: sessionData.site ? {
        id: sessionData.site.id,
        district: sessionData.site.district,
        subCounty: sessionData.site.subCounty,
        parish: sessionData.site.parish,
        sentinelSite: sessionData.site.sentinelSite,
        healthCenter: sessionData.site.healthCenter
      } : null,
      device: sessionData.device ? {
        id: sessionData.device.id,
        model: sessionData.device.model,
        registeredAt: new Date(sessionData.device.registeredAt).getTime()
      } : null
    };

    return reply.send(response);
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get session details');
  }
} 