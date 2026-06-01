import { FastifyReply, FastifyRequest } from 'fastify';
import { SessionUnit } from '../../../db/models';
import { findSession } from '../common';
import { formatSessionUnit, sessionUnitResponseSchema } from './common';

interface CreateSessionUnitBody {
  frontendId?: string | null;
  unitOrder: number;
  createdAt?: number;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Create a repeated collection unit under a session',
  params: {
    type: 'object',
    required: ['session_id'],
    properties: {
      session_id: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['unitOrder'],
    properties: {
      frontendId: { type: ['string', 'null'] },
      unitOrder: { type: 'number' },
      createdAt: { type: 'number' },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        sessionUnit: sessionUnitResponseSchema,
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export async function createSessionUnit(
  request: FastifyRequest<{ Params: { session_id: string }; Body: CreateSessionUnitBody }>,
  reply: FastifyReply
): Promise<void> {
  const session = await findSession(request.params.session_id);
  if (!session) {
    return reply.code(404).send({ error: 'Session not found' });
  }

  if (!Number.isInteger(request.body.unitOrder)) {
    return reply.code(400).send({ error: 'unitOrder must be an integer' });
  }

  const unit = await SessionUnit.create({
    sessionId: session.id,
    frontendId: request.body.frontendId ?? null,
    unitOrder: request.body.unitOrder,
    createdAt: request.body.createdAt !== undefined ? new Date(request.body.createdAt) : undefined,
  });

  return reply.code(201).send({
    message: 'Session unit created successfully',
    sessionUnit: formatSessionUnit(unit),
  });
}
