import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
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
  description: 'Create a new schedule and end the current open schedule at the new start date',
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

export async function changeProgramCollectionSchedule(
  request: FastifyRequest<{ Params: { program_id: number }; Body: CollectionScheduleBody }>,
  reply: FastifyReply
) {
  try {
    const input = toScheduleInput(request.body);
    const schedule = await sequelize.transaction(async (transaction) => {
      await validateProgramExists(request.params.program_id, transaction);
      validateScheduleInput(input);

      const activeSchedule = await CollectionSchedule.findOne({
        where: {
          programId: request.params.program_id,
          effectiveEndDate: null,
        },
        order: [['effectiveStartDate', 'DESC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const previousEndDate = input.previousEndDate ?? input.effectiveStartDate;

      if (activeSchedule && activeSchedule.effectiveStartDate >= input.effectiveStartDate) {
        throw new Error('New schedule must start after the current schedule starts');
      }
      if (previousEndDate > input.effectiveStartDate) {
        throw new Error('Previous schedule end date must be before or equal to the new schedule start date');
      }
      if (activeSchedule && previousEndDate <= activeSchedule.effectiveStartDate) {
        throw new Error('Previous schedule end date must be after the current schedule starts');
      }

      const overlappingFuture = await CollectionSchedule.findOne({
        where: {
          programId: request.params.program_id,
          id: activeSchedule ? { [Op.ne]: activeSchedule.id } : { [Op.ne]: 0 },
          effectiveStartDate: { [Op.lt]: new Date('9999-12-31T23:59:59.999Z') },
          [Op.or]: [
            { effectiveEndDate: null },
            { effectiveEndDate: { [Op.gt]: input.effectiveStartDate } },
          ],
        },
        transaction,
      });

      if (overlappingFuture) {
        throw new Error('Collection schedule overlaps an existing schedule');
      }

      if (activeSchedule) {
        await activeSchedule.update({ effectiveEndDate: previousEndDate }, { transaction });
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
