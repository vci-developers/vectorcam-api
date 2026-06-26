import ActiveUserMetric from '../db/models/ActiveUserMetric';
import {
  ActiveUserMetricCounts,
  computeRollingActiveUserMetrics,
  formatDateOnly,
} from './userActivity.service';

function getAsOfForSnapshotDate(snapshotDate: string): Date {
  return new Date(`${snapshotDate}T23:59:59.999Z`);
}

async function upsertActiveUserMetric(
  snapshotDate: string,
  programId: number | null,
  counts: ActiveUserMetricCounts
): Promise<void> {
  const existing = await ActiveUserMetric.findOne({
    where: {
      snapshotDate,
      programId,
    },
  });

  if (existing) {
    await existing.update({
      a1Count: counts.a1,
      a7Count: counts.a7,
      a30Count: counts.a30,
    });
    return;
  }

  await ActiveUserMetric.create({
    snapshotDate,
    programId,
    a1Count: counts.a1,
    a7Count: counts.a7,
    a30Count: counts.a30,
  });
}

export async function computeActiveUserMetrics(snapshotDate?: string): Promise<{
  snapshotDate: string;
  global: ActiveUserMetricCounts;
  programCount: number;
}> {
  const date = snapshotDate ?? formatDateOnly(new Date());
  const asOf = getAsOfForSnapshotDate(date);
  const { global, byProgram } = await computeRollingActiveUserMetrics(asOf);

  await upsertActiveUserMetric(date, null, global);

  for (const entry of byProgram) {
    await upsertActiveUserMetric(date, entry.programId, {
      a1: entry.a1,
      a7: entry.a7,
      a30: entry.a30,
    });
  }

  return {
    snapshotDate: date,
    global,
    programCount: byProgram.length,
  };
}
