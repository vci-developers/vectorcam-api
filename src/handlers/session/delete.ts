import { FastifyRequest, FastifyReply } from 'fastify';
import { findSessionById, hasSpecimens, handleError } from './common';

export const schema = {
  tags: ['Sessions'],
  description: 'Delete a session',
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
        message: { type: 'string' }
      }
    }
  }
};

export async function deleteSession(
  request: FastifyRequest<{ Params: { session_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;

    const session = await findSessionById(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Check if session has related specimens
    const specimensExist = await hasSpecimens(session_id);
    if (specimensExist) {
      return reply.code(400).send({ 
        error: 'Session cannot be deleted because it has associated specimens' 
      });
    }

    // Delete the session
    await session.destroy();

    reply.send({
      message: 'Session deleted successfully',
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to delete session');
  }
} 