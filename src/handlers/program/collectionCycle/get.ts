import { FastifyRequest, FastifyReply } from 'fastify';
import { CollectionCycle } from '../../../db/models';
import {
  collectionCycleResponseSchema,
  formatCollectionCycleResponse,
  handleCollectionCycleError,
} from './common';

export const schema = {
  tags: ['Collection Cycles'],
  description: 'Get a collection cycle by ID',
  params: {
    type: 'object',
    required: ['program_id', 'cycle_id'],
    properties: {
      program_id: { type: 'number' },
      cycle_id: { type: 'number' },
    },
  },
  response: {
    200: collectionCycleResponseSchema,
  },
};

export async function getCollectionCycle(
  request: FastifyRequest<{ Params: { program_id: number; cycle_id: number } }>,
  reply: FastifyReply
) {
  try {
    const cycle = await CollectionCycle.findOne({
      where: {
        id: request.params.cycle_id,
        programId: request.params.program_id,
      },
    });

    if (!cycle) {
      return reply.code(404).send({ error: 'Collection cycle not found' });
    }

    return reply.code(200).send(formatCollectionCycleResponse(cycle));
  } catch (error) {
    return handleCollectionCycleError(error, request, reply);
  }
}
