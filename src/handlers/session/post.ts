import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findDeviceById, 
  findSiteById, 
  formatSessionResponse,
  handleError
} from './common';
import { Session } from '../../db/models';

interface SubmitSessionRequest {
  frontendId?: number;
  houseNumber?: string;
  collectorTitle?: string;
  collectorName?: string;
  collectionDate?: number;
  collectionMethod?: string;
  specimenCondition?: string;
  completedAt?: number;
  submittedAt?: number;
  notes?: string;
  deviceId: number;
  siteId: number;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Submit a new session',
  body: {
    type: 'object',
    required: ['deviceId', 'siteId'],
    properties: {
      frontendId: { type: 'number' },
      houseNumber: { type: 'string' },
      collectorTitle: { type: 'string' },
      collectorName: { type: 'string' },
      collectionDate: { type: 'number' },
      collectionMethod: { type: 'string' },
      specimenCondition: { type: 'string' },
      completedAt: { type: 'number' },
      submittedAt: { type: 'number' },
      notes: { type: 'string' },
      deviceId: { type: 'number' },
      siteId: { type: 'number' }
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
      submittedAt,
      notes,
      deviceId, 
      siteId 
    } = request.body;

    // Check if device exists
    const device = await findDeviceById(deviceId);
    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    // Check if site exists
    const site = await findSiteById(siteId);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
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
      submittedAt: submittedAt ? new Date(submittedAt) : null,
      notes,
      deviceId,
      siteId,
    });

    reply.code(201).send({
      message: 'Session submitted successfully',
      session: formatSessionResponse(session),
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to submit session');
  }
} 