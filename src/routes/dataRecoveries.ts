import { FastifyInstance } from 'fastify';
import { requirePermission } from '../middleware/permission.middleware';
import {
  createDataRecovery,
  deleteDataRecovery,
  getDataRecovery,
  getDataRecoveryImage,
  getDataRecoveryList,
  updateDataRecovery,
  tusHandler,
} from '../handlers/dataRecovery';
import { schema as createDataRecoverySchema } from '../handlers/dataRecovery/post';
import { schema as getDataRecoveryListSchema } from '../handlers/dataRecovery/getList';
import { schema as getDataRecoverySchema } from '../handlers/dataRecovery/get';
import { schema as getDataRecoveryImageSchema } from '../handlers/dataRecovery/getImage';
import { schema as updateDataRecoverySchema } from '../handlers/dataRecovery/put';
import { schema as deleteDataRecoverySchema } from '../handlers/dataRecovery/delete';

const RECOVERY_BODY_LIMIT = 10 * 1024 * 1024;

export default async function dataRecoveryRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', {
    preHandler: [requirePermission('system:admin')],
    schema: getDataRecoveryListSchema,
  }, getDataRecoveryList as any);

  fastify.post('/', {
    preHandler: [requirePermission('mobile:app')],
    schema: createDataRecoverySchema,
    bodyLimit: RECOVERY_BODY_LIMIT,
  }, createDataRecovery as any);

  fastify.addContentTypeParser('application/offset+octet-stream', (_request, _payload, done) => {
    done(null);
  });

  fastify.all('/:id/tus', {
    preHandler: [requirePermission('mobile:app')],
  }, tusHandler);

  fastify.all('/:id/tus/*', {
    preHandler: [requirePermission('mobile:app')],
  }, tusHandler);

  fastify.get('/:id/image', {
    preHandler: [requirePermission('system:admin')],
    schema: getDataRecoveryImageSchema,
  }, getDataRecoveryImage as any);

  fastify.get('/:id', {
    preHandler: [requirePermission('system:admin')],
    schema: getDataRecoverySchema,
  }, getDataRecovery as any);

  fastify.put('/:id', {
    preHandler: [requirePermission('system:admin')],
    schema: updateDataRecoverySchema,
  }, updateDataRecovery as any);

  fastify.delete('/:id', {
    preHandler: [requirePermission('system:admin')],
    schema: deleteDataRecoverySchema,
  }, deleteDataRecovery as any);
}
