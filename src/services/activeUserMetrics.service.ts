import ActiveUserMetric from '../db/models/ActiveUserMetric';
import {
  ActiveUserMetricCounts,
  computeRollingActiveUserMetrics,
  formatDateOnly,
} from './userActivity.service';

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
  // Use the actual run time so rolling windows are correct when the cron fires
  // (e.g. at 00:00 UTC, end-of-today asOf would exclude all of yesterday from A1).
  const asOf = snapshotDate
    ? new Date(`${snapshotDate}T23:59:59.999Z`)
    : new Date();
  const date = snapshotDate ?? formatDateOnly(asOf);
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
