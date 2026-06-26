import { FastifyRequest, FastifyReply } from 'fastify';
import { UserAuthEventType } from '../../db/models/UserAuthEvent';
import { logUserAuthEvent } from '../../services/userAuthEvent.service';

export const logoutSchema: any = {
  tags: ['Authentication'],
  summary: 'User logout',
  description: 'Record a logout event for the authenticated user',
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
    401: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    if (request.authType !== 'user' || !request.user) {
      return reply.code(401).send({ error: 'Unauthorized: User authentication required' });
    }

    await logUserAuthEvent({
      userId: request.user.id,
      eventType: UserAuthEventType.LOGOUT,
      request,
    });

    return reply.code(200).send({ message: 'Logout recorded successfully' });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
