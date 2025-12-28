import { FastifyInstance } from 'fastify';
import {
  createProgram,
  getProgramDetails,
  updateProgram,
  deleteProgram
} from '../handlers/program';
import {
  getProgramForm,
  getProgramFormCurrent,
  getProgramFormList,
  updateProgramForm,
  checkoutProgramForm,
  publishProgramForm,
  createProgramFormQuestion,
  updateProgramFormQuestion,
  deleteProgramFormQuestion,
} from '../handlers/program/form';
import { getProgramList } from '../handlers/program/getList';
import { requireAdminAuth, requireAnyAuth, requireSuperAdmin } from '../middleware/auth.middleware';

import { schema as createSchema } from '../handlers/program/post';
import { schema as getSchema } from '../handlers/program/get';
import { schema as updateSchema } from '../handlers/program/put';
import { schema as deleteSchema } from '../handlers/program/delete';
import { schema as getListSchema } from '../handlers/program/getList';
import { schema as getProgramFormListSchema } from '../handlers/program/form/getList';
import { schema as getProgramFormSchema } from '../handlers/program/form/get';
import { schema as getProgramFormCurrentSchema } from '../handlers/program/form/getCurrent';
import { schema as updateProgramFormSchema } from '../handlers/program/form/put';
import { schema as checkoutProgramFormSchema } from '../handlers/program/form/checkout';
import { schema as publishProgramFormSchema } from '../handlers/program/form/publish';
import { schema as createProgramFormQuestionSchema } from '../handlers/program/form/questions/post';
import { schema as updateProgramFormQuestionSchema } from '../handlers/program/form/questions/put';
import { schema as deleteProgramFormQuestionSchema } from '../handlers/program/form/questions/delete';

import { createLocationType } from '../handlers/program/locationType/post';
import { getLocationTypeList } from '../handlers/program/locationType/getList';
import { getLocationType } from '../handlers/program/locationType/get';
import { updateLocationType } from '../handlers/program/locationType/put';
import { schema as createLocationTypeSchema } from '../handlers/program/locationType/post';
import { schema as getLocationTypeListSchema } from '../handlers/program/locationType/getList';
import { schema as getLocationTypeSchema } from '../handlers/program/locationType/get';
import { schema as updateLocationTypeSchema } from '../handlers/program/locationType/put';

export default async function programRoutes(fastify: FastifyInstance) {
  // Get all programs with filters
  fastify.get('/', {
    preHandler: [requireAdminAuth],
    schema: getListSchema,
  }, getProgramList as any);

  fastify.post('/', {
    preHandler: [requireAdminAuth],
    schema: createSchema,
  }, createProgram as any);

  fastify.get('/:program_id', {
    preHandler: [requireAdminAuth],
    schema: getSchema,
  }, getProgramDetails as any);

  fastify.put('/:program_id', {
    preHandler: [requireAdminAuth],
    schema: updateSchema,
  }, updateProgram as any);

  fastify.delete('/:program_id', {
    preHandler: [requireAdminAuth],
    schema: deleteSchema,
  }, deleteProgram as any);

  // Location types under programs
  fastify.get('/:program_id/location-types', {
    preHandler: [requireAdminAuth],
    schema: getLocationTypeListSchema,
  }, getLocationTypeList as any);

  fastify.post('/:program_id/location-types', {
    preHandler: [requireAdminAuth],
    schema: createLocationTypeSchema,
  }, createLocationType as any);

  fastify.get('/:program_id/location-types/:location_type_id', {
    preHandler: [requireAdminAuth],
    schema: getLocationTypeSchema,
  }, getLocationType as any);

  fastify.put('/:program_id/location-types/:location_type_id', {
    preHandler: [requireAdminAuth],
    schema: updateLocationTypeSchema,
  }, updateLocationType as any);

  // Program forms (superadmin only)
  fastify.get('/:program_id/forms', {
    preHandler: [requireAdminAuth],
    schema: getProgramFormListSchema,
  }, getProgramFormList as any);

  // Current (pointer or latest published)
  fastify.get('/:program_id/forms/current', {
    preHandler: [requireAnyAuth],
    schema: getProgramFormCurrentSchema,
  }, getProgramFormCurrent as any);

  fastify.get('/:program_id/forms/:version', {
    preHandler: [requireAdminAuth],
    schema: getProgramFormSchema,
  }, getProgramForm as any);

  fastify.put('/:program_id/forms', {
    preHandler: [requireAdminAuth],
    schema: updateProgramFormSchema,
  }, updateProgramForm as any);

  fastify.post('/:program_id/forms/:version/checkout', {
    preHandler: [requireAdminAuth],
    schema: checkoutProgramFormSchema,
  }, checkoutProgramForm as any);

  fastify.post('/:program_id/forms/publish', {
    preHandler: [requireAdminAuth],
    schema: publishProgramFormSchema,
  }, publishProgramForm as any);

  // Questions under a form (superadmin only, draft only)
  fastify.post('/:program_id/forms/questions', {
    preHandler: [requireAdminAuth],
    schema: createProgramFormQuestionSchema,
  }, createProgramFormQuestion as any);

  fastify.put('/:program_id/forms/questions/:question_id', {
    preHandler: [requireAdminAuth],
    schema: updateProgramFormQuestionSchema,
  }, updateProgramFormQuestion as any);

  fastify.delete('/:program_id/forms/questions/:question_id', {
    preHandler: [requireAdminAuth],
    schema: deleteProgramFormQuestionSchema,
  }, deleteProgramFormQuestion as any);
} 