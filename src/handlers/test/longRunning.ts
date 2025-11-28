import { FastifyRequest, FastifyReply } from 'fastify';
import logger from '../../utils/logger';

interface LongRunningQuery {
  seconds?: string;
}

/**
 * Test endpoint that simulates a long-running operation
 * Use query parameter ?seconds=X to specify duration (default: 60 seconds)
 * Maximum: 290 seconds (just under 5 minute timeout)
 */
export const longRunningTest = async (
  req: FastifyRequest<{ Querystring: LongRunningQuery }>,
  reply: FastifyReply
) => {
  try {
    const seconds = Math.min(
      parseInt(req.query.seconds || '60'),
      290 // Just under 5 minutes to ensure it completes
    );

    logger.info(`Starting long-running test for ${seconds} seconds`);

    const startTime = Date.now();

    // Simulate long-running operation with periodic heartbeat logs
    await new Promise<void>((resolve) => {
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 10;
        logger.info(`Long-running test progress: ${elapsed}/${seconds} seconds`);
        
        if (elapsed >= seconds) {
          clearInterval(interval);
          resolve();
        }
      }, 10000); // Log every 10 seconds
    });

    const endTime = Date.now();
    const actualDuration = (endTime - startTime) / 1000;

    return reply.status(200).send({
      success: true,
      message: 'Long-running test completed successfully',
      requestedDuration: seconds,
      actualDuration: actualDuration.toFixed(2),
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    });
  } catch (error) {
    logger.error('Error in long-running test:', error);
    return reply.status(500).send({
      success: false,
      message: 'Long-running test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

