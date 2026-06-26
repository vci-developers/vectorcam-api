import cron, { ScheduledTask } from 'node-cron';
import { FastifyBaseLogger } from 'fastify';
import { config } from '../config/environment';
import { computeActiveUserMetrics } from '../services/activeUserMetrics.service';

let scheduledTask: ScheduledTask | null = null;
let isRunning = false;

async function runActiveUserMetricsJob(logger: FastifyBaseLogger): Promise<void> {
  if (isRunning) {
    logger.warn('Active user metrics job skipped: previous run still in progress');
    return;
  }

  isRunning = true;
  try {
    const result = await computeActiveUserMetrics();
    logger.info(
      {
        snapshotDate: result.snapshotDate,
        a1: result.global.a1,
        a7: result.global.a7,
        a30: result.global.a30,
        programCount: result.programCount,
      },
      'Active user metrics snapshot completed'
    );
  } catch (error) {
    logger.error({ err: error }, 'Active user metrics job failed');
  } finally {
    isRunning = false;
  }
}

export function startActiveUserMetricsJob(logger: FastifyBaseLogger): void {
  const cronExpression = config.activeUserMetrics.cronSchedule;

  if (!cron.validate(cronExpression)) {
    logger.error({ cronExpression }, 'Invalid active user metrics cron expression');
    return;
  }

  scheduledTask = cron.schedule(
    cronExpression,
    () => {
      void runActiveUserMetricsJob(logger);
    },
    { timezone: 'UTC' }
  );

  logger.info({ cronExpression }, 'Scheduled active user metrics job');
}

export function stopActiveUserMetricsJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
