import { FastifyRequest, FastifyReply } from 'fastify';
import { Op, Transaction } from 'sequelize';
import sequelize from '../../../db';
import {
  CollectionCycle,
  CollectionSchedule,
  Program,
  Session,
  Site,
} from '../../../db/models';
import {
  CollectionScheduleCadenceType,
  CollectionScheduleIntervalUnit,
} from '../../../db/models/CollectionSchedule';

export interface CollectionScheduleInput {
  cadenceType: CollectionScheduleCadenceType;
  intervalUnit?: CollectionScheduleIntervalUnit | null;
  intervalCount?: number | null;
  effectiveStartDate: Date;
  previousEndDate?: Date | null;
}

export interface ManualCollectionCycleInput {
  collectionScheduleId: number;
  startDate: Date;
  endDate: Date;
}

export interface CollectionScheduleBody {
  cadenceType: CollectionScheduleCadenceType;
  intervalUnit?: CollectionScheduleIntervalUnit | null;
  intervalCount?: number | null;
  effectiveStartDate: number | string;
  previousEndDate?: number | string | null;
}

export interface CreateManualCycleBody {
  collectionScheduleId: number;
  startDate: number | string;
  endDate: number | string;
}

export interface GetCollectionCyclesQuery {
  startDate: number | string;
  endDate: number | string;
}

export const collectionScheduleResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    programId: { type: 'number' },
    cadenceType: { type: 'string', enum: Object.values(CollectionScheduleCadenceType) },
    intervalUnit: { type: ['string', 'null'], enum: [...Object.values(CollectionScheduleIntervalUnit), null] },
    intervalCount: { type: ['number', 'null'] },
    effectiveStartDate: { type: 'number' },
    effectiveEndDate: { type: ['number', 'null'] },
    createdAt: { type: 'number' },
    updatedAt: { type: 'number' },
  },
};

export const collectionScheduleBodySchema = {
  type: 'object',
  required: ['cadenceType', 'effectiveStartDate'],
  properties: {
    cadenceType: { type: 'string', enum: Object.values(CollectionScheduleCadenceType) },
    intervalUnit: { type: ['string', 'null'], enum: [...Object.values(CollectionScheduleIntervalUnit), null] },
    intervalCount: { type: ['number', 'null'] },
    effectiveStartDate: {
      anyOf: [
        { type: 'number' },
        { type: 'string' },
      ],
    },
    previousEndDate: {
      anyOf: [
        { type: 'number' },
        { type: 'string' },
        { type: 'null' },
      ],
    },
  },
};

export const collectionCycleResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    programId: { type: 'number' },
    collectionScheduleId: { type: 'number' },
    cycleNumber: { type: 'number' },
    startDate: { type: 'number' },
    endDate: { type: 'number' },
    createdAt: { type: 'number' },
    updatedAt: { type: 'number' },
    collectionSchedule: collectionScheduleResponseSchema,
  },
};

export function formatCollectionScheduleResponse(schedule: CollectionSchedule) {
  return {
    id: schedule.id,
    programId: schedule.programId,
    cadenceType: schedule.cadenceType,
    intervalUnit: schedule.intervalUnit,
    intervalCount: schedule.intervalCount,
    effectiveStartDate: schedule.effectiveStartDate.getTime(),
    effectiveEndDate: schedule.effectiveEndDate ? schedule.effectiveEndDate.getTime() : null,
    createdAt: schedule.createdAt.getTime(),
    updatedAt: schedule.updatedAt.getTime(),
  };
}

export function formatCollectionCycleResponse(cycle: CollectionCycle) {
  return {
    id: cycle.id,
    programId: cycle.programId,
    collectionScheduleId: cycle.collectionScheduleId,
    cycleNumber: cycle.cycleNumber,
    startDate: cycle.startDate.getTime(),
    endDate: cycle.endDate.getTime(),
    createdAt: cycle.createdAt.getTime(),
    updatedAt: cycle.updatedAt.getTime(),
  };
}

export function toScheduleInput(body: CollectionScheduleBody) {
  return {
    cadenceType: body.cadenceType,
    intervalUnit: body.intervalUnit,
    intervalCount: body.intervalCount,
    effectiveStartDate: parseDate(body.effectiveStartDate),
    previousEndDate: body.previousEndDate == null ? null : parseDate(body.previousEndDate),
  };
}

export function sendScheduleResponse(reply: FastifyReply, schedule: CollectionSchedule) {
  return reply.code(200).send({
    message: 'Collection schedule created successfully',
    collectionSchedule: formatCollectionScheduleResponse(schedule),
  });
}

export function parseDate(value: number | string): Date {
  const date = typeof value === 'number'
    ? new Date(value)
    : new Date(value.includes('T') ? value : `${value}T00:00:00.000Z`);

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }

  return date;
}

export function handleCollectionCycleError(error: any, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error);
  const message = error instanceof Error ? error.message : 'Internal Server Error';

  if (message.includes('not found')) {
    return reply.code(404).send({ error: message });
  }
  if (message.includes('overlap') || message.includes('exists')) {
    return reply.code(409).send({ error: message });
  }
  if (message.includes('Invalid') || message.includes('must') || message.includes('require')) {
    return reply.code(400).send({ error: message });
  }

  return reply.code(500).send({ error: 'Internal Server Error' });
}

export function toManualCycleInput(body: CreateManualCycleBody) {
  return {
    collectionScheduleId: body.collectionScheduleId,
    startDate: parseDate(body.startDate),
    endDate: parseDate(body.endDate),
  };
}

export async function assignCollectionCycleOnSessionUpload(
  sessionId: number,
  transaction?: Transaction
): Promise<CollectionCycle | null> {
  const session = await Session.findByPk(sessionId, {
    include: [{ model: Site, as: 'site' }],
    transaction,
  });

  if (!session || !session.collectionDate) {
    return null;
  }

  const site = session.get('site') as Site | undefined;
  const sessionSite = site ?? await Site.findByPk(session.siteId, { transaction });
  if (!sessionSite) {
    return null;
  }

  const schedule = await CollectionSchedule.findOne({
    where: {
      programId: sessionSite.programId,
      effectiveStartDate: { [Op.lte]: session.collectionDate },
      [Op.or]: [
        { effectiveEndDate: null },
        { effectiveEndDate: { [Op.gt]: session.collectionDate } },
      ],
    },
    order: [['effectiveStartDate', 'DESC']],
    transaction,
  });
  if (!schedule) {
    await session.update({ collectionCycleId: null }, { transaction });
    return null;
  }

  const cycle = schedule.cadenceType === CollectionScheduleCadenceType.RECURRING
    ? await findOrCreateGeneratedCollectionCycle(schedule, session.collectionDate, transaction)
    : await CollectionCycle.findOne({
        where: {
          collectionScheduleId: schedule.id,
          startDate: { [Op.lte]: session.collectionDate },
          endDate: { [Op.gt]: session.collectionDate },
        },
        transaction,
      });

  await session.update({ collectionCycleId: cycle?.id ?? null }, { transaction });
  return cycle;
}

export async function findOrCreateGeneratedCollectionCycle(
  schedule: CollectionSchedule,
  collectionDate: Date,
  transaction?: Transaction
): Promise<CollectionCycle> {
  assertRecurringSchedule(schedule);

  const target = getCycleBoundsForDate(schedule, collectionDate);
  await ensureRecurringCyclesExistThroughCycle(schedule, target.cycleNumber, transaction);

  const cycle = await CollectionCycle.findOne({
    where: {
      collectionScheduleId: schedule.id,
      cycleNumber: target.cycleNumber,
    },
    transaction,
  });

  if (!cycle) {
    throw new Error('Failed to create generated collection cycle');
  }

  return cycle;
}

export async function createManualCollectionCycle(
  programId: number,
  input: ManualCollectionCycleInput
): Promise<CollectionCycle> {
  return sequelize.transaction(async (transaction) => {
    if (input.startDate >= input.endDate) {
      throw new Error('startDate must be before endDate');
    }

    const schedule = await CollectionSchedule.findByPk(input.collectionScheduleId, { transaction });
    if (!schedule || schedule.programId !== programId) {
      throw new Error('Collection schedule not found for this program');
    }
    if (schedule.cadenceType !== CollectionScheduleCadenceType.MANUAL) {
      throw new Error('Manual cycles can only be created under a MANUAL schedule');
    }
    if (
      input.startDate < schedule.effectiveStartDate ||
      (schedule.effectiveEndDate && input.endDate > schedule.effectiveEndDate)
    ) {
      throw new Error('Manual cycle must be within the schedule effective window');
    }

    const overlap = await CollectionCycle.findOne({
      where: {
        collectionScheduleId: schedule.id,
        startDate: { [Op.lt]: input.endDate },
        endDate: { [Op.gt]: input.startDate },
      },
      transaction,
    });
    if (overlap) {
      throw new Error('Manual collection cycle overlaps an existing cycle');
    }

    const maxCycleNumber = await CollectionCycle.max('cycleNumber', {
      where: { collectionScheduleId: schedule.id },
      transaction,
    }) as number | null;

    return CollectionCycle.create({
      programId,
      collectionScheduleId: schedule.id,
      cycleNumber: (maxCycleNumber ?? 0) + 1,
      startDate: input.startDate,
      endDate: input.endDate,
    }, { transaction });
  });
}

export async function reassignSessionCollectionCycle(
  sessionId: string,
  collectionCycleId: number | null
): Promise<Session> {
  return sequelize.transaction(async (transaction) => {
    const numericId = parseInt(sessionId, 10);
    let session: Session | null = null;
    if (!isNaN(numericId)) {
      session = await Session.findByPk(numericId, { transaction });
    }
    if (!session) {
      session = await Session.findOne({
        where: { frontendId: sessionId },
        transaction,
      });
    }
    if (!session) {
      throw new Error('Session not found');
    }

    if (collectionCycleId === null) {
      await session.update({ collectionCycleId: null }, { transaction });
      return session;
    }

    const cycle = await CollectionCycle.findByPk(collectionCycleId, { transaction });
    if (!cycle) {
      throw new Error('Collection cycle not found');
    }

    const site = await Site.findByPk(session.siteId, { transaction });
    if (!site || site.programId !== cycle.programId) {
      throw new Error('Collection cycle does not belong to the session program');
    }

    await session.update({ collectionCycleId: cycle.id }, { transaction });
    return session;
  });
}

export async function ensureRecurringCyclesExistThroughCycle(
  schedule: CollectionSchedule,
  targetCycleNumber: number,
  transaction?: Transaction
): Promise<void> {
  for (let cycleNumber = 1; cycleNumber <= targetCycleNumber; cycleNumber += 1) {
    let startDate = new Date(schedule.effectiveStartDate);
    for (let current = 1; current < cycleNumber; current += 1) {
      startDate = addScheduleInterval(startDate, schedule);
    }
    const endDate = addScheduleInterval(startDate, schedule);
    if (schedule.effectiveEndDate && startDate >= schedule.effectiveEndDate) {
      break;
    }

    const boundedEndDate = schedule.effectiveEndDate && endDate > schedule.effectiveEndDate
      ? schedule.effectiveEndDate
      : endDate;

    await CollectionCycle.findOrCreate({
      where: {
        collectionScheduleId: schedule.id,
        cycleNumber,
      },
      defaults: {
        programId: schedule.programId,
        collectionScheduleId: schedule.id,
        cycleNumber,
        startDate,
        endDate: boundedEndDate,
      },
      transaction,
    });
  }
}

export function getCycleBoundsForDate(schedule: CollectionSchedule, date: Date) {
  let cycleNumber = 1;
  let startDate = new Date(schedule.effectiveStartDate);
  let endDate = addScheduleInterval(startDate, schedule);

  while (date >= endDate) {
    cycleNumber += 1;
    startDate = endDate;
    endDate = addScheduleInterval(startDate, schedule);
  }

  return { cycleNumber, startDate, endDate };
}

function addScheduleInterval(date: Date, schedule: CollectionSchedule): Date {
  const intervalCount = schedule.intervalCount ?? 0;
  const next = new Date(date);

  switch (schedule.intervalUnit) {
    case CollectionScheduleIntervalUnit.DAY:
      next.setUTCDate(next.getUTCDate() + intervalCount);
      break;
    case CollectionScheduleIntervalUnit.WEEK:
      next.setUTCDate(next.getUTCDate() + intervalCount * 7);
      break;
    case CollectionScheduleIntervalUnit.MONTH:
      next.setUTCMonth(next.getUTCMonth() + intervalCount);
      break;
    case CollectionScheduleIntervalUnit.YEAR:
      next.setUTCFullYear(next.getUTCFullYear() + intervalCount);
      break;
    default:
      throw new Error('Recurring schedules require intervalUnit');
  }

  return next;
}

export function assertRecurringSchedule(schedule: CollectionSchedule): void {
  if (
    schedule.cadenceType !== CollectionScheduleCadenceType.RECURRING ||
    !schedule.intervalUnit ||
    !schedule.intervalCount ||
    schedule.intervalCount < 1
  ) {
    throw new Error('Invalid recurring collection schedule');
  }
}

export function validateScheduleInput(input: CollectionScheduleInput): void {
  if (input.cadenceType === CollectionScheduleCadenceType.RECURRING) {
    if (!input.intervalUnit || !input.intervalCount || input.intervalCount < 1) {
      throw new Error('Recurring schedules require a positive interval');
    }
    return;
  }

  if (input.cadenceType === CollectionScheduleCadenceType.MANUAL) {
    return;
  }

  throw new Error('Invalid cadenceType');
}

export async function validateProgramExists(programId: number, transaction: Transaction): Promise<void> {
  const program = await Program.findByPk(programId, { transaction });
  if (!program) {
    throw new Error('Program not found');
  }
}
