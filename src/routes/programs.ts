import { FastifyInstance } from 'fastify';
import {
  createProgram,
  getProgramDetails,
  updateProgram,
  deleteProgram,
  verifyProgramAccessCode
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
import {
  requireAdminAuth,
  requireAnyWhitelistedAuth,
  requireAdminOrMobileAuth,
  requireAdminOrMobileOrSuperAdminAuth,
  requireAdminOrSuperAdminAuth,
  requireSuperAdmin,
} from '../middleware/auth.middleware';
import {
  createCollectionSchedule,
  changeProgramCollectionSchedule,
  getCollectionScheduleList,
} from '../handlers/program/collectionSchedule';
import {
  createCollectionCycle,
  getCollectionCycleList,
} from '../handlers/program/collectionCycle';
import { getUnassignedProgramSessions } from '../handlers/program/sessions';

import { schema as createSchema } from '../handlers/program/post';
import { schema as getSchema } from '../handlers/program/get';
import { schema as updateSchema } from '../handlers/program/put';
import { schema as deleteSchema } from '../handlers/program/delete';
import { schema as verifyAccessCodeSchema } from '../handlers/program/verifyAccessCode';
import { schema as getListSchema } from '../handlers/program/getList';
import { schema as createCollectionScheduleSchema } from '../handlers/program/collectionSchedule/post';
import { schema as changeCollectionScheduleSchema } from '../handlers/program/collectionSchedule/change';
import { schema as getCollectionScheduleListSchema } from '../handlers/program/collectionSchedule/getList';
import { schema as createCollectionCycleSchema } from '../handlers/program/collectionCycle/post';
import { schema as getCollectionCycleListSchema } from '../handlers/program/collectionCycle/getList';
import { schema as getUnassignedProgramSessionsSchema } from '../handlers/program/sessions/getUnassigned';
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
import { deleteLocationType } from '../handlers/program/locationType/delete';
import { schema as createLocationTypeSchema } from '../handlers/program/locationType/post';
import { schema as getLocationTypeListSchema } from '../handlers/program/locationType/getList';
import { schema as getLocationTypeSchema } from '../handlers/program/locationType/get';
import { schema as updateLocationTypeSchema } from '../handlers/program/locationType/put';
import { schema as deleteLocationTypeSchema } from '../handlers/program/locationType/delete';

export default async function programRoutes(fastify: FastifyInstance) {
  // Get all programs with filters
  fastify.get('/', {
    schema: getListSchema,
  }, getProgramList as any);

  fastify.post('/:program_id/verify-access-code', {
    schema: verifyAccessCodeSchema,
  }, verifyProgramAccessCode as any);

  fastify.post('/', {
    preHandler: [requireAdminAuth],
    schema: createSchema,
  }, createProgram as any);

  fastify.get('/:program_id/collection-schedules', {
    preHandler: [requireAnyWhitelistedAuth],
    schema: getCollectionScheduleListSchema,
  }, getCollectionScheduleList as any);

  fastify.post('/:program_id/collection-schedules', {
    preHandler: [requireAdminAuth],
    schema: createCollectionScheduleSchema,
  }, createCollectionSchedule as any);

  fastify.post('/:program_id/collection-schedules/change', {
    preHandler: [requireAdminAuth],
    schema: changeCollectionScheduleSchema,
  }, changeProgramCollectionSchedule as any);

  fastify.get('/:program_id/collection-cycles', {
    preHandler: [requireAnyWhitelistedAuth],
    schema: getCollectionCycleListSchema,
  }, getCollectionCycleList as any);

  fastify.post('/:program_id/collection-cycles', {
    preHandler: [requireAdminAuth],
    schema: createCollectionCycleSchema,
  }, createCollectionCycle as any);

  fastify.get('/:program_id/sessions/unassigned', {
    preHandler: [requireAdminOrMobileAuth],
    schema: getUnassignedProgramSessionsSchema,
  }, getUnassignedProgramSessions as any);

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
    preHandler: [requireAdminOrMobileOrSuperAdminAuth],
    schema: getLocationTypeListSchema,
  }, getLocationTypeList as any);

  fastify.post('/:program_id/location-types', {
    preHandler: [requireAdminOrSuperAdminAuth],
    schema: createLocationTypeSchema,
  }, createLocationType as any);

  fastify.get('/:program_id/location-types/:location_type_id', {
    preHandler: [requireAdminOrMobileOrSuperAdminAuth],
    schema: getLocationTypeSchema,
  }, getLocationType as any);

  fastify.put('/:program_id/location-types/:location_type_id', {
    preHandler: [requireAdminOrSuperAdminAuth],
    schema: updateLocationTypeSchema,
  }, updateLocationType as any);

  fastify.delete('/:program_id/location-types/:location_type_id', {
    preHandler: [requireAdminOrSuperAdminAuth],
    schema: deleteLocationTypeSchema,
  }, deleteLocationType as any);

  fastify.get('/:program_id/forms', {
    preHandler: [requireAnyWhitelistedAuth],
    schema: getProgramFormListSchema,
  }, getProgramFormList as any);

  // Current (pointer or latest published)
  fastify.get('/:program_id/forms/current', {
    preHandler: [requireAnyWhitelistedAuth],
    schema: getProgramFormCurrentSchema,
  }, getProgramFormCurrent as any);

  fastify.get('/:program_id/forms/:version', {
    preHandler: [requireAnyWhitelistedAuth],
    schema: getProgramFormSchema,
  }, getProgramForm as any);

  // update program form (superadmin only)
  fastify.put('/:program_id/forms', {
    preHandler: [requireSuperAdmin],
    schema: updateProgramFormSchema,
  }, updateProgramForm as any);

  fastify.post('/:program_id/forms/:version/checkout', {
    preHandler: [requireSuperAdmin],
    schema: checkoutProgramFormSchema,
  }, checkoutProgramForm as any);

  fastify.post('/:program_id/forms/publish', {
    preHandler: [requireSuperAdmin],
    schema: publishProgramFormSchema,
  }, publishProgramForm as any);

  // Questions under a form (superadmin only, draft only)
  fastify.post('/:program_id/forms/questions', {
    preHandler: [requireSuperAdmin],
    schema: createProgramFormQuestionSchema,
  }, createProgramFormQuestion as any);

  fastify.put('/:program_id/forms/questions/:question_id', {
    preHandler: [requireSuperAdmin],
    schema: updateProgramFormQuestionSchema,
  }, updateProgramFormQuestion as any);

  fastify.delete('/:program_id/forms/questions/:question_id', {
    preHandler: [requireSuperAdmin],
    schema: deleteProgramFormQuestionSchema,
  }, deleteProgramFormQuestion as any);
} 