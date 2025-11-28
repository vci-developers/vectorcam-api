import { FastifyInstance } from 'fastify';
import { longRunningTest } from '../handlers/test/longRunning';

export default async function testRoutes(server: FastifyInstance) {
  /**
   * @route   GET /test/long-running
   * @desc    Test endpoint for long-running operations (timeout testing)
   * @query   seconds - Duration in seconds (default: 60, max: 290)
   * @access  Public
   */
  server.get('/long-running', longRunningTest);
}

