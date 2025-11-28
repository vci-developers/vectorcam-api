import { FastifyRequest, FastifyReply } from 'fastify';
import logger from '../../utils/logger';

interface LongRunningQuery {
  seconds?: string;
  stream?: string;
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
      290
    );
    const stream = (req.query.stream || '').toLowerCase() === 'true' || req.query.stream === '1';

    logger.info(`Starting long-running test for ${seconds} seconds`);

    const startTime = Date.now();

    if (stream) {
      // Stream a chunked response so Nginx receives headers immediately and does not 504 on header wait
      reply.raw.setHeader('Content-Type', 'text/plain; charset=utf-8');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.raw.setHeader('Transfer-Encoding', 'chunked');
      if (typeof (reply.raw as any).flushHeaders === 'function') {
        (reply.raw as any).flushHeaders();
      }
      // Take control of the underlying stream
      reply.hijack();

      reply.raw.write(`starting ${seconds}s job\n`);

      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 10;
        logger.info(`Long-running test progress: ${elapsed}/${seconds} seconds`);
        reply.raw.write(`progress ${elapsed}/${seconds}\n`);
        if (elapsed >= seconds) {
          clearInterval(interval);
          const endTime = Date.now();
          const actualDuration = ((endTime - startTime) / 1000).toFixed(2);
          reply.raw.end(`done ${actualDuration}s\n`);
        }
      }, 10000);

      return;
    }

    // Non-streaming path (waits then replies once)
    await new Promise<void>((resolve) => {
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 10;
        logger.info(`Long-running test progress: ${elapsed}/${seconds} seconds`);
        if (elapsed >= seconds) {
          clearInterval(interval);
          resolve();
        }
      }, 10000);
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

