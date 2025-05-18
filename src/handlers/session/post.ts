import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findDeviceById, 
  findSiteById, 
  formatSessionResponse,
  handleError
} from './common';
import { Session } from '../../db/models';

interface SubmitSessionRequest {
  deviceId: number;
  siteId: number;
  createdAt: string;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Submit a new session',
  body: {
    type: 'object',
    required: ['deviceId', 'siteId', 'createdAt'],
    properties: {
      deviceId: { type: 'number' },
      siteId: { type: 'number' },
      createdAt: { type: 'string', format: 'date-time' }
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
            deviceId: { type: 'number' },
            siteId: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
            submittedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }
};

export async function submitSession(
  request: FastifyRequest<{ Body: SubmitSessionRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { deviceId, siteId, createdAt } = request.body;

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

    // Create the session - ID will be auto-generated
    const session = await Session.create({
      deviceId,
      siteId,
      createdAt: new Date(createdAt),
      submittedAt: new Date(),
    });

    reply.code(201).send({
      message: 'Session submitted successfully',
      session: formatSessionResponse(session),
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to submit session');
  }
} 