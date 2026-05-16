import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { CollectionCycle, CollectionSchedule } from '../../../db/models';
import { CollectionScheduleCadenceType } from '../../../db/models/CollectionSchedule';
import {
  assertRecurringSchedule,
  ensureRecurringCyclesExistThroughCycle,
  formatCollectionCycleResponse,
  getCycleBoundsForDate,
  handleCollectionCycleError,
  parseDate,
} from './common';
import {
  GetCollectionCyclesQuery,
  collectionCycleResponseSchema,
} from './common';

export const schema = {
  tags: ['Collection Cycles'],
  description: 'Get collection cycles for a bounded range, generating recurring cycles lazily',
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  querystring: {
    type: 'object',
    required: ['startDate', 'endDate'],
    properties: {
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
        collectionCycles: {
          type: 'array',
          items: collectionCycleResponseSchema,
        },
      },
    },
  },
};

export async function getCollectionCycleList(
  request: FastifyRequest<{ Params: { program_id: number }; Querystring: GetCollectionCyclesQuery }>,
  reply: FastifyReply
) {
  try {
    const fromDate = parseDate(request.query.startDate);
    const toDate = parseDate(request.query.endDate);

    if (fromDate >= toDate) {
      throw new Error('fromDate must be before toDate');
    }

    const schedules = await CollectionSchedule.findAll({
      where: {
        programId: request.params.program_id,
        cadenceType: CollectionScheduleCadenceType.RECURRING,
        effectiveStartDate: { [Op.lt]: toDate },
        [Op.or]: [
          { effectiveEndDate: null },
          { effectiveEndDate: { [Op.gt]: fromDate } },
        ],
      },
      order: [['effectiveStartDate', 'ASC']],
    });

    for (const schedule of schedules) {
      assertRecurringSchedule(schedule);
      const scheduleEnd = schedule.effectiveEndDate && schedule.effectiveEndDate < toDate
        ? schedule.effectiveEndDate
        : toDate;
      const targetDate = new Date(scheduleEnd.getTime() - 1);
      if (targetDate < schedule.effectiveStartDate) {
        continue;
      }
      const target = getCycleBoundsForDate(schedule, targetDate);
      await ensureRecurringCyclesExistThroughCycle(schedule, target.cycleNumber);
    }

    const cycles = await CollectionCycle.findAll({
      where: {
        programId: request.params.program_id,
        startDate: { [Op.lt]: toDate },
        endDate: { [Op.gt]: fromDate },
      },
      order: [['startDate', 'ASC'], ['cycleNumber', 'ASC']],
    });

    return reply.code(200).send({
      collectionCycles: cycles.map(formatCollectionCycleResponse),
    });
  } catch (error) {
    return handleCollectionCycleError(error, request, reply);
  }
}
