import { FastifyRequest, FastifyReply } from 'fastify';
import { CollectionSchedule } from '../../../db/models';
import {
  collectionScheduleResponseSchema,
  formatCollectionScheduleResponse,
  handleCollectionCycleError,
} from './common';

export const schema = {
  tags: ['Collection Cycles'],
  description: 'Get all collection schedules for a program',
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        collectionSchedules: {
          type: 'array',
          items: collectionScheduleResponseSchema,
        },
      },
    },
  },
};

export async function getCollectionScheduleList(
  request: FastifyRequest<{ Params: { program_id: number } }>,
  reply: FastifyReply
) {
  try {
    const schedules = await CollectionSchedule.findAll({
      where: { programId: request.params.program_id },
      order: [['effectiveStartDate', 'ASC'], ['id', 'ASC']],
    });

    return reply.code(200).send({
      collectionSchedules: schedules.map(formatCollectionScheduleResponse),
    });
  } catch (error) {
    return handleCollectionCycleError(error, request, reply);
  }
}
