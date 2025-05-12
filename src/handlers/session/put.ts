import { FastifyRequest, FastifyReply } from 'fastify';
import { findSessionById, findSiteById, formatSessionResponse, handleError } from './common';

interface UpdateSessionRequest {
  siteId?: number;
}

export const schema = {
  params: {
    type: 'object',
    properties: {
      session_id: { type: 'number' }
    }
  },
  body: {
    type: 'object',
    properties: {
      siteId: { type: 'number' }
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
            deviceId: { type: 'number' },
            siteId: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
            submittedAt: { type: ['string', 'null'], format: 'date-time' }
          }
        }
      }
    }
  }
};

export async function updateSession(
  request: FastifyRequest<{ Params: { session_id: number }; Body: UpdateSessionRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;
    const { siteId } = request.body;

    const session = await findSessionById(session_id);
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

    // Update the session
    await session.update({
      siteId: siteId || session.siteId,
    });

    reply.send({
      message: 'Session updated successfully',
      session: formatSessionResponse(session),
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to update session');
  }
} 