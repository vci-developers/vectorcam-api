import { FastifyInstance } from 'fastify';
import { getDhis2SyncTask, syncToDHIS2 } from '../handlers/dhis2';
import { schema as syncSchema, taskStatusSchema } from '../handlers/dhis2/sync';
import { requirePermission } from '../middleware/permission.middleware';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Start an async DHIS2 sync for a specific month (sites are limited to the caller's dhis2:push scope)
  fastify.post('/sync', {
    preHandler: [requirePermission('dhis2:push')],
    schema: syncSchema
  }, syncToDHIS2 as any);

  fastify.get('/sync', {
    preHandler: [requirePermission('dhis2:push')],
    schema: taskStatusSchema
  }, getDhis2SyncTask as any);

  fastify.get('/sync/:taskId', {
    preHandler: [requirePermission('dhis2:push')],
    schema: taskStatusSchema
  }, getDhis2SyncTask as any);

  done();
}
