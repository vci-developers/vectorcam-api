import { FastifyInstance } from 'fastify';
import { requireAdminAuth, requireAdminOrMobileAuth } from '../middleware/auth.middleware';
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
    preHandler: [requireAdminAuth],
    schema: getDataRecoveryListSchema,
  }, getDataRecoveryList as any);

  fastify.post('/', {
    preHandler: [requireAdminOrMobileAuth],
    schema: createDataRecoverySchema,
    bodyLimit: RECOVERY_BODY_LIMIT,
  }, createDataRecovery as any);

  fastify.addContentTypeParser('application/offset+octet-stream', (_request, _payload, done) => {
    done(null);
  });

  fastify.all('/:id/tus', {
    preHandler: [requireAdminOrMobileAuth],
  }, tusHandler);

  fastify.all('/:id/tus/*', {
    preHandler: [requireAdminOrMobileAuth],
  }, tusHandler);

  fastify.get('/:id/image', {
    preHandler: [requireAdminAuth],
    schema: getDataRecoveryImageSchema,
  }, getDataRecoveryImage as any);

  fastify.get('/:id', {
    preHandler: [requireAdminAuth],
    schema: getDataRecoverySchema,
  }, getDataRecovery as any);

  fastify.put('/:id', {
    preHandler: [requireAdminAuth],
    schema: updateDataRecoverySchema,
  }, updateDataRecovery as any);

  fastify.delete('/:id', {
    preHandler: [requireAdminAuth],
    schema: deleteDataRecoverySchema,
  }, deleteDataRecovery as any);
}
