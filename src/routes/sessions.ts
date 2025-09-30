import { FastifyInstance } from 'fastify';
import { 
  submitSession,
  getSessionDetails,
  updateSession,
  deleteSession,
  getSessionsByUser,
  getSessionsBySite,
  getSessionSpecimens,
  getSessionSurvey,
  exportSessionsCSV,
  exportSurveillanceFormsCSV,
  createSurvey,
  updateSurvey
} from '../handlers/session';
import { getSessionList } from '../handlers/session/getList';
import { getSessionReviewTask } from '../handlers/session/getReviewTask';
import * as sessionSpecimenHandlers from '../handlers/session/specimens';

// Import schemas from handler files
import { schema as submitSchema } from '../handlers/session/post';
import { schema as getSchema } from '../handlers/session/get';
import { schema as updateSchema } from '../handlers/session/put';
import { schema as deleteSchema } from '../handlers/session/delete';
import { schema as getListSchema } from '../handlers/session/getList';
import { schema as getReviewTaskSchema } from '../handlers/session/getReviewTask';
import { schema as getByUserSchema } from '../handlers/session/getByUser';
import { schema as getBySiteSchema } from '../handlers/session/getBySite';
import { schema as getSpecimensSchema } from '../handlers/session/specimens/getList';
import { ExportSessionsCSVRequest, schema as exportSessionsCSVSchema } from '../handlers/session/export';
import { ExportSurveillanceFormsCSVRequest, schema as exportSurveillanceFormsCSVSchema } from '../handlers/session/survey/exportSurvey';
import { schema as getSurveySchema } from '../handlers/session/survey/getSurvey';
import { schema as createSurveySchema } from '../handlers/session/survey/postSurvey';
import { schema as updateSurveySchema } from '../handlers/session/survey/putSurvey';
import { schema as getSessionSpecimenSchema } from '../handlers/session/specimens/get';
import { schema as createSessionSpecimenSchema } from '../handlers/session/specimens/post';
import { schema as updateSessionSpecimenSchema } from '../handlers/session/specimens/put';
import { schema as deleteSessionSpecimenSchema } from '../handlers/session/specimens/delete';
import { requireAdminAuth } from '../middleware/auth.middleware';
import { 
  siteAccessMiddleware,
  requireSiteReadAccess,
  requireSiteWriteAccess,
  requireSpecificSiteReadAccess
} from '../middleware/siteAccess.middleware';
import {
  requireSpecificSessionReadAccess,
  requireSpecificSessionWriteAccess,
  requireSiteSessionAccess
} from '../middleware/sessionAccess.middleware';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Register site access middleware for all routes
  fastify.addHook('preHandler', siteAccessMiddleware);

  // Get all sessions with comprehensive filters (requires read access)
  fastify.get('/', {
    preHandler: [requireSiteReadAccess],
    schema: getListSchema
  }, getSessionList as any);

  // Get session review grouped by district and month (requires read access)
  fastify.get('/review/task', {
    preHandler: [requireSiteReadAccess],
    schema: getReviewTaskSchema
    }, getSessionReviewTask as any);

  // Submit a new session (requires write access)
  fastify.post('/', {
    preHandler: [requireSiteWriteAccess],
    schema: submitSchema
  }, submitSession as any);

  // Get session details by ID or frontendId (requires access to specific session)
  fastify.get('/:session_id', {
    preHandler: [requireSpecificSessionReadAccess],
    schema: getSchema
  }, getSessionDetails as any);

  // Update an existing session (requires write access to specific session)
  fastify.put('/:session_id', {
    preHandler: [requireSpecificSessionWriteAccess],
    schema: updateSchema
  }, updateSession as any);

  // Delete a session (requires write access to specific session)
  fastify.delete('/:session_id', {
    preHandler: [requireSpecificSessionWriteAccess],
    schema: deleteSchema
  }, deleteSession as any);

  // Get sessions by user (requires read access)
  fastify.get('/users/:user_id', {
    preHandler: [requireSiteReadAccess],
    schema: getByUserSchema
  }, getSessionsByUser as any);

  // Get sessions by site (requires access to specific site)
  fastify.get('/sites/:site_id', {
    preHandler: [requireSpecificSiteReadAccess],
    schema: getBySiteSchema
  }, getSessionsBySite as any);

  // Get specimens for a session (requires access to specific session)
  fastify.get('/:session_id/specimens', {
    preHandler: [requireSpecificSessionReadAccess],
    schema: getSpecimensSchema
  }, getSessionSpecimens as any);

  // Create a specimen under a session (requires write access to specific session)
  fastify.post('/:session_id/specimens', {
    preHandler: [requireSpecificSessionWriteAccess],
    schema: createSessionSpecimenSchema
  }, sessionSpecimenHandlers.createSessionSpecimen as any);

  // Get a single specimen under a session (requires access to specific session)
  fastify.get('/:session_id/specimens/:specimen_id', {
    preHandler: [requireSpecificSessionReadAccess],
    schema: getSessionSpecimenSchema
  }, sessionSpecimenHandlers.getSessionSpecimen as any);

  // Update a specimen under a session (requires write access to specific session)
  fastify.put('/:session_id/specimens/:specimen_id', {
    preHandler: [requireSpecificSessionWriteAccess],
    schema: updateSessionSpecimenSchema
  }, sessionSpecimenHandlers.updateSessionSpecimen as any);

  // Delete a specimen under a session (requires write access to specific session)
  fastify.delete('/:session_id/specimens/:specimen_id', {
    preHandler: [requireSpecificSessionWriteAccess],
    schema: deleteSessionSpecimenSchema
  }, sessionSpecimenHandlers.deleteSessionSpecimen as any);

  // Get session surveillance form (requires access to specific session)
  fastify.get('/:session_id/survey', {
    preHandler: [requireSpecificSessionReadAccess],
    schema: getSurveySchema
  }, getSessionSurvey as any);

  // Create session surveillance form (requires write access to specific session)
  fastify.post('/:session_id/survey', {
    preHandler: [requireSpecificSessionWriteAccess],
    schema: createSurveySchema
  }, createSurvey as any);

  // Update session surveillance form (requires write access to specific session)
  fastify.put('/:session_id/survey', {
    preHandler: [requireSpecificSessionWriteAccess],
    schema: updateSurveySchema
  }, updateSurvey as any);

  // Export sessions as CSV
  fastify.get<ExportSessionsCSVRequest>('/export/csv', {
    schema: exportSessionsCSVSchema,
    preHandler: [requireAdminAuth],
  }, exportSessionsCSV);

  // Export surveillance forms as CSV
  fastify.get<ExportSurveillanceFormsCSVRequest>('/export/surveillance-forms/csv', {
    schema: exportSurveillanceFormsCSVSchema,
    preHandler: [requireAdminAuth],
  }, exportSurveillanceFormsCSV);

  done();
} 