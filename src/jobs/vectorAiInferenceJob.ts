import cron, { ScheduledTask } from 'node-cron';
import { FastifyBaseLogger } from 'fastify';
import { config } from '../config/environment';
import { runVectorAiInferenceCron } from '../services/vectorAiInference.service';

let scheduledTask: ScheduledTask | null = null;
let isRunning = false;

async function runVectorAiInferenceJob(logger: FastifyBaseLogger): Promise<void> {
  if (isRunning) {
    logger.warn('Vector AI inference job skipped: previous run still in progress');
    return;
  }

  isRunning = true;
  try {
    const stats = await runVectorAiInferenceCron();
    logger.info(stats, 'Vector AI inference batch completed');
  } catch (error) {
    logger.error({ err: error }, 'Vector AI inference job failed');
  } finally {
    isRunning = false;
  }
}

export function startVectorAiInferenceJob(logger: FastifyBaseLogger): void {
  if (!config.vectorAiInference.enabled) {
    logger.info('Vector AI inference cron is disabled');
    return;
  }

  const cronExpression = config.vectorAiInference.cronSchedule;

  if (!cron.validate(cronExpression)) {
    logger.error({ cronExpression }, 'Invalid Vector AI inference cron expression');
    return;
  }

  scheduledTask = cron.schedule(
    cronExpression,
    () => {
      void runVectorAiInferenceJob(logger);
    },
    { timezone: 'UTC' }
  );

  logger.info({ cronExpression }, 'Scheduled Vector AI inference job');
}

export function stopVectorAiInferenceJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}
