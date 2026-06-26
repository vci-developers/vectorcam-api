import { Op } from 'sequelize';
import { User } from '../db/models';

const LAST_ACTIVE_THROTTLE_MS = 15 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const lastActiveUpdateTimestamps = new Map<number, number>();

export interface ActiveUserMetricCounts {
  a1: number;
  a7: number;
  a30: number;
}

export interface ActiveUserMetricsSnapshot {
  global: ActiveUserMetricCounts;
  byProgram: Array<{ programId: number | null } & ActiveUserMetricCounts>;
}

export async function updateUserLastActive(userId: number): Promise<void> {
  const now = Date.now();
  const lastUpdate = lastActiveUpdateTimestamps.get(userId);
  if (lastUpdate !== undefined && now - lastUpdate < LAST_ACTIVE_THROTTLE_MS) {
    return;
  }

  lastActiveUpdateTimestamps.set(userId, now);

  await User.update(
    { lastActiveAt: new Date(now) },
    { where: { id: userId } }
  );
}

export function recordUserActivity(userId: number): void {
  void updateUserLastActive(userId).catch(() => undefined);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getWindowStart(asOf: Date, windowDays: number): Date {
  return new Date(asOf.getTime() - windowDays * MS_PER_DAY);
}

async function countActiveUsers(
  asOf: Date,
  windowDays: number,
  programId?: number | null
): Promise<number> {
  const where: Record<string, unknown> = {
    isActive: true,
    lastActiveAt: {
      [Op.gte]: getWindowStart(asOf, windowDays),
      [Op.lte]: asOf,
    },
  };

  if (programId !== undefined) {
    where.programId = programId;
  }

  return User.count({ where });
}

async function countActiveUsersByProgram(
  asOf: Date,
  windowDays: number
): Promise<Map<number | null, number>> {
  const users = await User.findAll({
    attributes: ['programId'],
    where: {
      isActive: true,
      lastActiveAt: {
        [Op.gte]: getWindowStart(asOf, windowDays),
        [Op.lte]: asOf,
      },
    },
    raw: true,
  });

  const counts = new Map<number | null, number>();
  for (const user of users) {
    const programId = user.programId;
    counts.set(programId, (counts.get(programId) ?? 0) + 1);
  }

  return counts;
}

export async function computeRollingActiveUserMetrics(
  asOf: Date = new Date()
): Promise<ActiveUserMetricsSnapshot> {
  const [globalA1, globalA7, globalA30, a1ByProgram, a7ByProgram, a30ByProgram] = await Promise.all([
    countActiveUsers(asOf, 1),
    countActiveUsers(asOf, 7),
    countActiveUsers(asOf, 30),
    countActiveUsersByProgram(asOf, 1),
    countActiveUsersByProgram(asOf, 7),
    countActiveUsersByProgram(asOf, 30),
  ]);

  const programIds = new Set<number | null>([
    ...a1ByProgram.keys(),
    ...a7ByProgram.keys(),
    ...a30ByProgram.keys(),
  ]);

  return {
    global: {
      a1: globalA1,
      a7: globalA7,
      a30: globalA30,
    },
    byProgram: Array.from(programIds).map((programId) => ({
      programId,
      a1: a1ByProgram.get(programId) ?? 0,
      a7: a7ByProgram.get(programId) ?? 0,
      a30: a30ByProgram.get(programId) ?? 0,
    })),
  };
}
