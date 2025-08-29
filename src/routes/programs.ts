import { FastifyInstance } from 'fastify';
import {
  createProgram,
  getProgramDetails,
  updateProgram,
  deleteProgram
} from '../handlers/program';
import { getProgramList } from '../handlers/program/getList';
import { mobileAuthMiddleware } from '../middleware/mobileAuth.middleware';

import { schema as createSchema } from '../handlers/program/post';
import { schema as getSchema } from '../handlers/program/get';
import { schema as updateSchema } from '../handlers/program/put';
import { schema as deleteSchema } from '../handlers/program/delete';
import { schema as getListSchema } from '../handlers/program/getList';

export default async function programRoutes(fastify: FastifyInstance) {
  // Get all programs with filters
  fastify.get('/', {
    preHandler: [mobileAuthMiddleware],
    schema: getListSchema,
  }, getProgramList as any);

  fastify.post('/', {
    preHandler: [mobileAuthMiddleware],
    schema: createSchema,
  }, createProgram as any);

  fastify.get('/:program_id', {
    preHandler: [mobileAuthMiddleware],
    schema: getSchema,
  }, getProgramDetails as any);

  fastify.put('/:program_id', {
    preHandler: [mobileAuthMiddleware],
    schema: updateSchema,
  }, updateProgram as any);

  fastify.delete('/:program_id', {
    preHandler: [mobileAuthMiddleware],
    schema: deleteSchema,
  }, deleteProgram as any);
} 