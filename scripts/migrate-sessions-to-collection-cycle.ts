import { Op, QueryTypes, Transaction } from 'sequelize';
import sequelize from '../src/db/index';
import { CollectionCycle, CollectionSchedule, Program, Session, Site } from '../src/db/models';
import { CollectionScheduleCadenceType } from '../src/db/models/CollectionSchedule';
import {
  assertRecurringSchedule,
  getCycleBoundsForDate,
} from '../src/handlers/program/collectionCycle/common';

interface Args {
  programId: number;
  commit: boolean;
  overwrite: boolean;
}

interface Stats {
  total: number;
  assigned: number;
  wouldAssign: number;
  alreadyAssigned: number;
  noActiveSchedule: number;
  noMatchingManualCycle: number;
  existingCycles: number;
  createdRecurringCycles: number;
}

interface CollectionCycleContext {
  schedules: CollectionSchedule[];
  cyclesByScheduleId: Map<number, CollectionCycle[]>;
  cyclesByScheduleAndNumber: Map<string, CollectionCycle>;
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string | boolean>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      continue;
    }

    const [key, inlineValue] = arg.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      values.set(key, inlineValue);
      continue;
    }

    const nextValue = argv[index + 1];
    if (nextValue && !nextValue.startsWith('--')) {
      values.set(key, nextValue);
      index += 1;
    } else {
      values.set(key, true);
    }
  }

  const programId = parsePositiveInteger(values.get('program-id'), 'program-id');
  return {
    programId,
    commit: values.has('commit'),
    overwrite: values.has('overwrite'),
  };
}

function parsePositiveInteger(value: string | boolean | undefined, name: string): number {
  if (typeof value !== 'string') {
    throw new Error(`Missing required --${name}`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }

  return parsed;
}

function printUsage(): void {
  console.log(`
Usage:
  ts-node scripts/migrate-sessions-to-collection-cycle.ts --program-id <id> [--commit] [--overwrite]

Options:
  --program-id              Program whose sessions should be migrated.
  --commit                  Apply changes. Without this flag, the script runs as a dry run.
  --overwrite               Reassign sessions that already have a different collection_cycle_id.

The script only migrates SURVEILLANCE sessions with a collection_date.
It uses the active collection schedule for each session date. Existing cycles are reused; missing recurring
cycles are created only when --commit is provided.
`);
}

async function migrateSessionsToCollectionCycle(args: Args): Promise<void> {
  const program = await Program.findByPk(args.programId);
  if (!program) {
    throw new Error(`Program not found with id ${args.programId}`);
  }

  console.log(`Program: ${program.name} (${program.id})`);
  console.log('Session type: SURVEILLANCE');
  console.log(`Overwrite existing assignments: ${args.overwrite ? 'yes' : 'no'}`);

  if (!args.commit) {
    const stats = await processSessions(args);
    printStats(stats, false);
    console.log('Dry run only. Re-run with --commit to apply this migration.');
    return;
  }

  const stats = await sequelize.transaction((transaction) => processSessions(args, transaction));
  printStats(stats, true);
}

async function processSessions(args: Args, transaction?: Transaction): Promise<Stats> {
  const stats: Stats = {
    total: 0,
    assigned: 0,
    wouldAssign: 0,
    alreadyAssigned: 0,
    noActiveSchedule: 0,
    noMatchingManualCycle: 0,
    existingCycles: 0,
    createdRecurringCycles: 0,
  };
  let lastSeenId = 0;
  let batchNumber = 0;
  const context = await loadCollectionCycleContext(args.programId, transaction);
  const createdRecurringCycleKeys = new Set<string>();

  while (true) {
    const sessions = await Session.findAll({
      where: {
        id: { [Op.gt]: lastSeenId },
        type: 'SURVEILLANCE',
        collectionDate: { [Op.ne]: null },
      },
      include: [
        {
          model: Site,
          as: 'site',
          attributes: ['id', 'programId'],
          where: { programId: args.programId },
          required: true,
        },
      ],
      order: [['id', 'ASC']],
      limit: 500,
      transaction,
    });

    if (sessions.length === 0) {
      break;
    }

    batchNumber += 1;
    const collectionCycleIdBySessionId = new Map<number, number>();

    for (const session of sessions) {
      lastSeenId = session.id;
      stats.total += 1;

      if (!args.overwrite && session.collectionCycleId !== null) {
        stats.alreadyAssigned += 1;
        continue;
      }

      const cycle = await resolveCycleForSession(
        args.programId,
        session.collectionDate,
        context,
        !!transaction,
        transaction
      );
      if (!cycle) {
        stats.noActiveSchedule += 1;
        continue;
      }
      if (cycle === 'NO_MANUAL_CYCLE') {
        stats.noMatchingManualCycle += 1;
        continue;
      }

      if (cycle.created) {
        const key = `${cycle.collectionCycle.collectionScheduleId}:${cycle.collectionCycle.cycleNumber}`;
        if (!createdRecurringCycleKeys.has(key)) {
          createdRecurringCycleKeys.add(key);
          stats.createdRecurringCycles += 1;
        }
      } else {
        stats.existingCycles += 1;
      }

      if (!transaction) {
        stats.wouldAssign += 1;
        continue;
      }

      collectionCycleIdBySessionId.set(session.id, cycle.collectionCycle.id);
    }

    if (transaction && collectionCycleIdBySessionId.size > 0) {
      await bulkUpdateSessionCollectionCycles(collectionCycleIdBySessionId, transaction);
      stats.assigned += collectionCycleIdBySessionId.size;
    }

    printProgress(batchNumber, stats);
  }

  return stats;
}

async function bulkUpdateSessionCollectionCycles(
  collectionCycleIdBySessionId: Map<number, number>,
  transaction: Transaction
): Promise<void> {
  const assignments = [...collectionCycleIdBySessionId.entries()];
  const caseStatements = assignments
    .map(([sessionId, collectionCycleId]) => `WHEN ${sessionId} THEN ${collectionCycleId}`)
    .join(' ');
  const sessionIds = assignments.map(([sessionId]) => sessionId).join(', ');

  await sequelize.query(
    `
      UPDATE sessions
      SET collection_cycle_id = CASE id ${caseStatements} END,
          updated_at = NOW()
      WHERE id IN (${sessionIds})
    `,
    { type: QueryTypes.UPDATE, transaction }
  );
}

async function loadCollectionCycleContext(
  programId: number,
  transaction?: Transaction
): Promise<CollectionCycleContext> {
  const [schedules, collectionCycles] = await Promise.all([
    CollectionSchedule.findAll({
      where: { programId },
      order: [['effectiveStartDate', 'DESC']],
      transaction,
    }),
    CollectionCycle.findAll({
      where: { programId },
      order: [['collectionScheduleId', 'ASC'], ['startDate', 'ASC']],
      transaction,
    }),
  ]);
  const cyclesByScheduleId = new Map<number, CollectionCycle[]>();
  const cyclesByScheduleAndNumber = new Map<string, CollectionCycle>();

  for (const cycle of collectionCycles) {
    const scheduleCycles = cyclesByScheduleId.get(cycle.collectionScheduleId) ?? [];
    scheduleCycles.push(cycle);
    cyclesByScheduleId.set(cycle.collectionScheduleId, scheduleCycles);
    cyclesByScheduleAndNumber.set(getScheduleCycleKey(cycle.collectionScheduleId, cycle.cycleNumber), cycle);
  }

  return {
    schedules,
    cyclesByScheduleId,
    cyclesByScheduleAndNumber,
  };
}

async function resolveCycleForSession(
  programId: number,
  collectionDate: Date | null,
  context: CollectionCycleContext,
  shouldCreateRecurringCycle: boolean,
  transaction?: Transaction
): Promise<{ collectionCycle: CollectionCycle; created: boolean } | 'NO_MANUAL_CYCLE' | null> {
  if (!collectionDate) {
    return null;
  }

  const schedule = context.schedules.find((candidate) => isDateInSchedule(candidate, collectionDate));
  if (!schedule) {
    return null;
  }

  if (schedule.cadenceType === CollectionScheduleCadenceType.MANUAL) {
    const collectionCycle = context.cyclesByScheduleId
      .get(schedule.id)
      ?.find((cycle) => isDateInCycle(cycle, collectionDate));

    return collectionCycle ? { collectionCycle, created: false } : 'NO_MANUAL_CYCLE';
  }

  assertRecurringSchedule(schedule);
  const target = getCycleBoundsForDate(schedule, collectionDate);
  const key = getScheduleCycleKey(schedule.id, target.cycleNumber);
  const existingCycle = context.cyclesByScheduleAndNumber.get(key);

  if (existingCycle) {
    return { collectionCycle: existingCycle, created: false };
  }

  if (!shouldCreateRecurringCycle) {
    return {
      collectionCycle: CollectionCycle.build({
        programId,
        collectionScheduleId: schedule.id,
        cycleNumber: target.cycleNumber,
        startDate: target.startDate,
        endDate: schedule.effectiveEndDate && target.endDate > schedule.effectiveEndDate
          ? schedule.effectiveEndDate
          : target.endDate,
      }),
      created: true,
    };
  }

  const [collectionCycle, created] = await CollectionCycle.findOrCreate({
    where: {
      collectionScheduleId: schedule.id,
      cycleNumber: target.cycleNumber,
    },
    defaults: {
      programId,
      collectionScheduleId: schedule.id,
      cycleNumber: target.cycleNumber,
      startDate: target.startDate,
      endDate: schedule.effectiveEndDate && target.endDate > schedule.effectiveEndDate
        ? schedule.effectiveEndDate
        : target.endDate,
    },
    transaction,
  });
  const scheduleCycles = context.cyclesByScheduleId.get(schedule.id) ?? [];
  scheduleCycles.push(collectionCycle);
  context.cyclesByScheduleId.set(schedule.id, scheduleCycles);
  context.cyclesByScheduleAndNumber.set(key, collectionCycle);

  return { collectionCycle, created };
}

function isDateInSchedule(schedule: CollectionSchedule, date: Date): boolean {
  return schedule.effectiveStartDate <= date && (!schedule.effectiveEndDate || schedule.effectiveEndDate > date);
}

function isDateInCycle(cycle: CollectionCycle, date: Date): boolean {
  return cycle.startDate <= date && cycle.endDate > date;
}

function getScheduleCycleKey(collectionScheduleId: number, cycleNumber: number): string {
  return `${collectionScheduleId}:${cycleNumber}`;
}

function printProgress(batchNumber: number, stats: Stats): void {
  console.log(
    `Processed batch ${batchNumber}: scanned ${stats.total}, ` +
    `assigned ${stats.assigned}, would assign ${stats.wouldAssign}, ` +
    `skipped ${stats.alreadyAssigned + stats.noActiveSchedule + stats.noMatchingManualCycle}`
  );
}

function printStats(stats: Stats, committed: boolean): void {
  console.log(`Scanned sessions: ${stats.total}`);
  console.log(`Assigned sessions: ${stats.assigned}`);
  console.log(`Would assign sessions: ${stats.wouldAssign}`);
  console.log(`Sessions using existing cycles: ${stats.existingCycles}`);
  console.log(`Recurring cycles ${committed ? 'created' : 'to create'}: ${stats.createdRecurringCycles}`);
  console.log(`Skipped, already assigned: ${stats.alreadyAssigned}`);
  console.log(`Skipped, no active schedule: ${stats.noActiveSchedule}`);
  console.log(`Skipped, manual schedule without matching cycle: ${stats.noMatchingManualCycle}`);
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    await migrateSessionsToCollectionCycle(args);
    process.exit(0);
  } catch (error) {
    printUsage();
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main();
}

export default migrateSessionsToCollectionCycle;
