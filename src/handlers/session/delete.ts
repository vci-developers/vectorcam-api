import { FastifyRequest, FastifyReply } from 'fastify';
import { findSessionById, hasSpecimens, handleError } from './common';
import { Session, Site } from '../../db/models';

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
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' }
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

    // If no sessions remain for the site, reset hasData flag
    const remaining = await Session.count({ where: { siteId: session.siteId } });
    if (remaining === 0) {
      const site = await Site.findByPk(session.siteId);
      if (site && site.hasData) {
        await site.update({ hasData: false });
      }
    }

    return reply.send({
      message: 'Session deleted successfully',
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to delete session');
  }
} 