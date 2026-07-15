import { FastifyInstance } from 'fastify';
import { longRunningTest } from '../handlers/test/longRunning';
import { mockConflictSessions, schema as mockConflictSessionsSchema } from '../handlers/test/mockConflictSessions';
import { requireAdminAuth } from '../middleware/auth.middleware';

export default async function testRoutes(server: FastifyInstance) {
  /**
   * @route   GET /test/long-running
   * @desc    Test endpoint for long-running operations (timeout testing)
   * @query   seconds - Duration in seconds (default: 60, max: 290)
   * @access  Public
   */
  server.get('/long-running', longRunningTest);

  /**
   * @route   POST /test/mock-conflict-sessions
   * @desc    Create mock conflict sessions for a site (admin only)
   * @access  Admin token or developer user
   */
  server.post('/mock-conflict-sessions', {
    preHandler: [requireAdminAuth],
    schema: mockConflictSessionsSchema,
  }, mockConflictSessions as any);
}

