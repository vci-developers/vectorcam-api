import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findDeviceById, 
  findSiteById, 
  formatSessionResponse,
  handleError
} from './common';
import { Session } from '../../db/models';

interface SubmitSessionRequest {
  frontendId: string;
  houseNumber?: string;
  collectorTitle?: string;
  collectorName?: string;
  collectionDate?: number;
  collectionMethod?: string;
  specimenCondition?: string;
  completedAt?: number;
  createdAt?: number;
  notes?: string;
  siteId: number;
  deviceId: number;
  latitude?: number;
  longitude?: number;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Submit a new session',
  body: {
    type: 'object',
    required: ['frontendId', 'siteId', 'deviceId'],
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
    201: {
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

export async function submitSession(
  request: FastifyRequest<{ Body: SubmitSessionRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
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

    // Check if site exists
    const site = await findSiteById(siteId);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    // Check if device exists
    const device = await findDeviceById(deviceId);
    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    // Check if frontendId is unique if provided
    if (frontendId) {
      const existingSession = await Session.findOne({
        where: { frontendId }
      });
      if (existingSession) {
        return reply.code(409).send({ error: 'A session with this frontendId already exists' });
      }
    }

    // Create the session
    const session = await Session.create({
      frontendId,
      houseNumber,
      collectorTitle,
      collectorName,
      collectionDate: collectionDate ? new Date(collectionDate) : null,
      collectionMethod,
      specimenCondition,
      completedAt: completedAt ? new Date(completedAt) : null,
      createdAt: createdAt ? new Date(createdAt) : null,
      notes,
      siteId,
      deviceId,
      latitude,
      longitude
    });

    return reply.code(201).send({
      message: 'Session submitted successfully',
      session: formatSessionResponse(session),
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to submit session');
  }
} 