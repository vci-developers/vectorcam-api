import { FastifyInstance } from 'fastify';
import { syncToDHIS2 } from '../handlers/dhis2';
import { schema as syncSchema } from '../handlers/dhis2/sync';
import { authMiddleware, requireAdmin } from '../middleware/auth.middleware';
import { siteAccessMiddleware, requireSiteWriteAccess } from '../middleware/siteAccess.middleware';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Sync data to DHIS2 for a specific month (admin and super admin only)
  fastify.post('/sync', {
    preHandler: [authMiddleware, requireAdmin, siteAccessMiddleware, requireSiteWriteAccess],
    schema: syncSchema
  }, syncToDHIS2 as any);

  done();
}

