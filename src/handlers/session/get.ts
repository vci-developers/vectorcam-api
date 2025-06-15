import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findSessionById, 
  formatSessionResponse, 
  handleError 
} from './common';

export const schema = {
  tags: ['Sessions'],
  description: 'Get session details',
  params: {
    type: 'object',
    properties: {
      session_id: { type: 'number' }
    }
  },
  response: {
    200: {
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
};

export async function getSessionDetails(
  request: FastifyRequest<{ Params: { session_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;

    const session = await findSessionById(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    reply.send(formatSessionResponse(session));
  } catch (error) {
    handleError(error, request, reply, 'Failed to get session details');
  }
} 