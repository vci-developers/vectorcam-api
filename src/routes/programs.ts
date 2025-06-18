import { FastifyInstance } from 'fastify';
import {
  createProgram,
  getProgramDetails,
  updateProgram,
  deleteProgram
} from '../handlers/program';
import { getProgramList } from '../handlers/program/getList';

import { schema as createSchema } from '../handlers/program/post';
import { schema as getSchema } from '../handlers/program/get';
import { schema as updateSchema } from '../handlers/program/put';
import { schema as deleteSchema } from '../handlers/program/delete';
import { schema as getListSchema } from '../handlers/program/getList';

export default async function programRoutes(fastify: FastifyInstance) {
  // Get all programs with filters
  fastify.get('/', {
    schema: getListSchema,
  }, getProgramList);

  fastify.post('/', {
    schema: createSchema,
  }, createProgram);

  fastify.get('/:program_id', {
    schema: getSchema,
  }, getProgramDetails);

  fastify.put('/:program_id', {
    schema: updateSchema,
  }, updateProgram);

  fastify.delete('/:program_id', {
    schema: deleteSchema,
  }, deleteProgram);
} 