import { FastifyRequest, FastifyReply } from 'fastify';
import { findSessionById, findSiteById, findDeviceById, formatSessionResponse, handleError, findSession } from './common';
import { Session } from '../../db/models';

interface UpdateSessionRequest {
  frontendId?: string;
  houseNumber?: string;
  collectorTitle?: string;
  collectorName?: string;
  collectionDate?: number;
  collectionMethod?: string;
  specimenCondition?: string;
  completedAt?: number;
  createdAt?: number;
  notes?: string;
  siteId?: number;
  deviceId?: number;
  latitude?: number;
  longitude?: number;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Update session details',
  params: {
    type: 'object',
    properties: {
      session_id: { type: 'string' }
    }
  },
  body: {
    type: 'object',
    properties: {
      frontendId: { type: 'string', maxLength: 64 },
      houseNumber: { type: 'string' },
      collectorTitle: { type: 'string' },
      collectorName: { type: 'string' },
      collectionDate: { type: 'number' },
      collectionMethod: { type: 'string' },
      specimenCondition: { type: 'string' },
      completedAt: { type: 'number' },
      createdAt: { type: 'number' },
      notes: { type: 'string' },
      siteId: { type: 'number' },
      deviceId: { type: 'number' },
      latitude: { type: 'number' },
      longitude: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        session: {
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
            latitude: { type: ['number', 'null'] },
            longitude: { type: ['number', 'null'] }
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
    409: {
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

export async function updateSession(
  request: FastifyRequest<{ Params: { session_id: string }; Body: UpdateSessionRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;
    const { 
      frontendId,
      houseNumber,
      collectorTitle,
      collectorName,
      collectionDate,
      collectionMethod,
      specimenCondition,
      completedAt,
      createdAt,
      notes,
      siteId,
      deviceId,
      latitude,
      longitude
    } = request.body;

    const session = await findSession(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Check if site exists when updating siteId
    if (siteId) {
      const site = await findSiteById(siteId);
      if (!site) {
        return reply.code(404).send({ error: 'Site not found' });
      }
    }

    // Check if device exists when updating deviceId
    if (deviceId) {
      const device = await findDeviceById(deviceId);
      if (!device) {
        return reply.code(404).send({ error: 'Device not found' });
      }
    }

    // Check if frontendId is unique if provided
    if (frontendId && frontendId !== session.frontendId) {
      const existingSession = await Session.findOne({
        where: { frontendId }
      });
      if (existingSession) {
        return reply.code(409).send({ error: 'A session with this frontendId already exists' });
      }
    }

    // Update the session
    await session.update({
      frontendId: frontendId !== undefined ? frontendId : session.frontendId,
      houseNumber: houseNumber !== undefined ? houseNumber : session.houseNumber,
      collectorTitle: collectorTitle !== undefined ? collectorTitle : session.collectorTitle,
      collectorName: collectorName !== undefined ? collectorName : session.collectorName,
      collectionDate: collectionDate !== undefined ? new Date(collectionDate) : session.collectionDate,
      collectionMethod: collectionMethod !== undefined ? collectionMethod : session.collectionMethod,
      specimenCondition: specimenCondition !== undefined ? specimenCondition : session.specimenCondition,
      completedAt: completedAt !== undefined ? new Date(completedAt) : session.completedAt,
      createdAt: createdAt !== undefined ? new Date(createdAt) : session.createdAt,
      notes: notes !== undefined ? notes : session.notes,
      siteId: siteId || session.siteId,
      deviceId: deviceId || session.deviceId,
      latitude: latitude !== undefined ? latitude : session.latitude,
      longitude: longitude !== undefined ? longitude : session.longitude
    });

    return reply.send({
      message: 'Session updated successfully',
      session: formatSessionResponse(session),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 