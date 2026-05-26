import { FastifyReply, FastifyRequest } from 'fastify';
import { FormAnswer, SessionUnit, Specimen } from '../../../db/models';
import { findSession } from '../common';

export const schema = {
  tags: ['Sessions'],
  description: 'Delete a repeated collection unit if it has no dependent answers or specimens',
  params: {
    type: 'object',
    required: ['session_id', 'session_unit_id'],
    properties: {
      session_id: { type: 'string' },
      session_unit_id: { type: 'string' },
    },
  },
};

export async function deleteSessionUnit(
  request: FastifyRequest<{ Params: { session_id: string; session_unit_id: string } }>,
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

  const [answerCount, specimenCount] = await Promise.all([
    FormAnswer.count({ where: { sessionUnitId: unit.id } }),
    Specimen.count({ where: { sessionUnitId: unit.id } }),
  ]);

  if (answerCount > 0 || specimenCount > 0) {
    return reply.code(409).send({ error: 'Session unit has dependent answers or specimens' });
  }

  await unit.destroy();
  return reply.code(204).send();
}
