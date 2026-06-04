import { FastifyInstance } from 'fastify';
import { getDhis2SyncTask, syncToDHIS2 } from '../handlers/dhis2';
import { schema as syncSchema, taskStatusSchema } from '../handlers/dhis2/sync';
import { authMiddleware, requireAdmin } from '../middleware/auth.middleware';
import { siteAccessMiddleware, requireSiteWriteAccess } from '../middleware/siteAccess.middleware';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Start an async DHIS2 sync for a specific month (admin token or user with privilege >= 2, no mobile token)
  fastify.post('/sync', {
    preHandler: [authMiddleware, requireAdmin, siteAccessMiddleware, requireSiteWriteAccess],
    schema: syncSchema
  }, syncToDHIS2 as any);

  fastify.get('/sync', {
    preHandler: [authMiddleware, requireAdmin, siteAccessMiddleware, requireSiteWriteAccess],
    schema: taskStatusSchema
  }, getDhis2SyncTask as any);

  fastify.get('/sync/:taskId', {
    preHandler: [authMiddleware, requireAdmin, siteAccessMiddleware, requireSiteWriteAccess],
    schema: taskStatusSchema
  }, getDhis2SyncTask as any);

  done();
}

