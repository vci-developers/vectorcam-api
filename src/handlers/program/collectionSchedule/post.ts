import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../../db';
import { CollectionSchedule } from '../../../db/models';
import { CollectionScheduleCadenceType } from '../../../db/models/CollectionSchedule';
import {
  CollectionScheduleBody,
  collectionScheduleBodySchema,
  collectionScheduleResponseSchema,
  handleCollectionCycleError,
  sendScheduleResponse,
  toScheduleInput,
  validateProgramExists,
  validateScheduleInput,
} from './common';

export const schema = {
  tags: ['Collection Cycles'],
  description: 'Create the first collection schedule for a program',
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  body: collectionScheduleBodySchema,
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        collectionSchedule: collectionScheduleResponseSchema,
      },
    },
  },
};

export async function createCollectionSchedule(
  request: FastifyRequest<{ Params: { program_id: number }; Body: CollectionScheduleBody }>,
  reply: FastifyReply
) {
  try {
    const input = toScheduleInput(request.body);
    const schedule = await sequelize.transaction(async (transaction) => {
      await validateProgramExists(request.params.program_id, transaction);
      validateScheduleInput(input);

      const existingScheduleCount = await CollectionSchedule.count({
        where: { programId: request.params.program_id },
        transaction,
      });
      if (existingScheduleCount > 0) {
        throw new Error('Collection schedule already exists for this program');
      }

      return CollectionSchedule.create({
        programId: request.params.program_id,
        cadenceType: input.cadenceType,
        intervalUnit: input.cadenceType === CollectionScheduleCadenceType.RECURRING ? input.intervalUnit : null,
        intervalCount: input.cadenceType === CollectionScheduleCadenceType.RECURRING ? input.intervalCount : null,
        effectiveStartDate: input.effectiveStartDate,
        effectiveEndDate: null,
      }, { transaction });
    });

    return sendScheduleResponse(reply, schedule);
  } catch (error) {
    return handleCollectionCycleError(error, request, reply);
  }
}
