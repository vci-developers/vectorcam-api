import { FastifyReply, FastifyRequest } from 'fastify';
import { SessionUnit } from '../../../db/models';
import { findSession } from '../common';
import { formatSessionUnit } from './common';

export const schema = {
  tags: ['Sessions'],
  description: 'List repeated collection units under a session',
  params: {
    type: 'object',
    required: ['session_id'],
    properties: {
      session_id: { type: 'string' },
    },
  },
};

export async function getSessionUnits(
  request: FastifyRequest<{ Params: { session_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const session = await findSession(request.params.session_id);
  if (!session) {
    return reply.code(404).send({ error: 'Session not found' });
  }

  const units = await SessionUnit.findAll({
    where: { sessionId: session.id },
    order: [['unitOrder', 'ASC'], ['id', 'ASC']],
  });

  return reply.send({
    sessionId: session.id,
    units: units.map(formatSessionUnit),
  });
}
