import { FastifyRequest, FastifyReply } from 'fastify';
import {
  CreateManualCycleBody,
  collectionCycleResponseSchema,
  createManualCollectionCycle,
  formatCollectionCycleResponse,
  handleCollectionCycleError,
  toManualCycleInput,
} from './common';

export const schema = {
  tags: ['Collection Cycles'],
  description: 'Create a manual collection cycle under a MANUAL schedule',
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  body: {
    type: 'object',
    required: ['collectionScheduleId', 'startDate', 'endDate'],
    properties: {
      collectionScheduleId: { type: 'number' },
      startDate: {
        anyOf: [
          { type: 'number' },
          { type: 'string' },
        ],
      },
      endDate: {
        anyOf: [
          { type: 'number' },
          { type: 'string' },
        ],
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        collectionCycle: collectionCycleResponseSchema,
      },
    },
  },
};

export async function createCollectionCycle(
  request: FastifyRequest<{ Params: { program_id: number }; Body: CreateManualCycleBody }>,
  reply: FastifyReply
) {
  try {
    const cycle = await createManualCollectionCycle(
      request.params.program_id,
      toManualCycleInput(request.body)
    );

    return reply.code(200).send({
      message: 'Collection cycle created successfully',
      collectionCycle: formatCollectionCycleResponse(cycle),
    });
  } catch (error) {
    return handleCollectionCycleError(error, request, reply);
  }
}
