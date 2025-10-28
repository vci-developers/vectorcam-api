import { FastifyInstance } from 'fastify';
import { syncToDHIS2 } from '../handlers/dhis2';
import { schema as syncSchema } from '../handlers/dhis2/sync';
import { requireAdminAuth } from '../middleware/auth.middleware';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Sync data to DHIS2 for a specific month (admin only)
  fastify.post('/sync', {
    preHandler: [requireAdminAuth],
    schema: syncSchema
  }, syncToDHIS2 as any);

  done();
}

