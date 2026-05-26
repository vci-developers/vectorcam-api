import { FastifyReply, FastifyRequest } from 'fastify';
import { SessionUnit } from '../../../db/models';
import { findSession } from '../common';
import { formatSessionUnit } from './common';

interface UpdateSessionUnitBody {
  frontendId?: string | null;
  unitOrder?: number;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Update repeated collection unit metadata',
  params: {
    type: 'object',
    required: ['session_id', 'session_unit_id'],
    properties: {
      session_id: { type: 'string' },
      session_unit_id: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      frontendId: { type: ['string', 'null'] },
      unitOrder: { type: 'number' },
    },
  },
};

export async function updateSessionUnit(
  request: FastifyRequest<{ Params: { session_id: string; session_unit_id: string }; Body: UpdateSessionUnitBody }>,
  reply: FastifyReply
): Promise<void> {
  const session = await findSession(request.params.session_id);
  if (!session) {
    return reply.code(404).send({ error: 'Session not found' });
  }

  const unitId = Number(request.params.session_unit_id);
  if (!Number.isInteger(unitId) || unitId <= 0) {
    return reply.code(400).send({ error: 'Invalid session unit id' });
  }

  const unit = await SessionUnit.findOne({ where: { id: unitId, sessionId: session.id } });
  if (!unit) {
    return reply.code(404).send({ error: 'Session unit not found' });
  }

  if (request.body.unitOrder !== undefined && !Number.isInteger(request.body.unitOrder)) {
    return reply.code(400).send({ error: 'unitOrder must be an integer' });
  }

  await unit.update({
    frontendId: request.body.frontendId !== undefined ? request.body.frontendId : unit.frontendId,
    unitOrder: request.body.unitOrder !== undefined ? request.body.unitOrder : unit.unitOrder,
  });

  return reply.send(formatSessionUnit(unit));
}
