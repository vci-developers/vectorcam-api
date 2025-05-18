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
        deviceId: { type: 'number' },
        siteId: { type: 'number' },
        createdAt: { type: 'string', format: 'date-time' },
        submittedAt: { type: 'string', format: 'date-time' }
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