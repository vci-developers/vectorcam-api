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
import * as sessionSpecimenHandlers from '../handlers/session/specimens';

// Import schemas from handler files
import { schema as submitSchema } from '../handlers/session/post';
import { schema as getSchema } from '../handlers/session/get';
import { schema as updateSchema } from '../handlers/session/put';
import { schema as deleteSchema } from '../handlers/session/delete';
import { schema as getListSchema } from '../handlers/session/getList';
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
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware';
import { mobileAuthMiddleware } from '../middleware/mobileAuth.middleware';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Get all sessions with comprehensive filters
  fastify.get('/', {
    preHandler: [mobileAuthMiddleware],
    schema: getListSchema
  }, getSessionList as any);

  // Submit a new session
  fastify.post('/', {
    preHandler: [mobileAuthMiddleware],
    schema: submitSchema
  }, submitSession as any);

  // Get session details by ID or frontendId (as string)
  fastify.get('/:session_id', {
    preHandler: [mobileAuthMiddleware],
    schema: getSchema
  }, getSessionDetails as any);

  // Update an existing session
  fastify.put('/:session_id', {
    preHandler: [mobileAuthMiddleware],
    schema: updateSchema
  }, updateSession as any);

  // Delete a session
  fastify.delete('/:session_id', {
    preHandler: [mobileAuthMiddleware],
    schema: deleteSchema
  }, deleteSession as any);

  // Get sessions by user
  fastify.get('/users/:user_id', {
    preHandler: [mobileAuthMiddleware],
    schema: getByUserSchema
  }, getSessionsByUser as any);

  // Get sessions by site
  fastify.get('/sites/:site_id', {
    preHandler: [mobileAuthMiddleware],
    schema: getBySiteSchema
  }, getSessionsBySite as any);

  // Get specimens for a session
  fastify.get('/:session_id/specimens', {
    preHandler: [mobileAuthMiddleware],
    schema: getSpecimensSchema
  }, getSessionSpecimens as any);

  // Create a specimen under a session
  fastify.post('/:session_id/specimens', {
    preHandler: [mobileAuthMiddleware],
    schema: createSessionSpecimenSchema
  }, sessionSpecimenHandlers.createSessionSpecimen as any);

  // Get a single specimen under a session
  fastify.get('/:session_id/specimens/:specimen_id', {
    preHandler: [mobileAuthMiddleware],
    schema: getSessionSpecimenSchema
  }, sessionSpecimenHandlers.getSessionSpecimen as any);

  // Update a specimen under a session
  fastify.put('/:session_id/specimens/:specimen_id', {
    preHandler: [mobileAuthMiddleware],
    schema: updateSessionSpecimenSchema
  }, sessionSpecimenHandlers.updateSessionSpecimen as any);

  // Delete a specimen under a session
  fastify.delete('/:session_id/specimens/:specimen_id', {
    preHandler: [mobileAuthMiddleware],
    schema: deleteSessionSpecimenSchema
  }, sessionSpecimenHandlers.deleteSessionSpecimen as any);

  // Get session surveillance form
  fastify.get('/:session_id/survey', {
    preHandler: [mobileAuthMiddleware],
    schema: getSurveySchema
  }, getSessionSurvey as any);

  // Create session surveillance form
  fastify.post('/:session_id/survey', {
    preHandler: [mobileAuthMiddleware],
    schema: createSurveySchema
  }, createSurvey as any);

  // Update session surveillance form
  fastify.put('/:session_id/survey', {
    preHandler: [mobileAuthMiddleware],
    schema: updateSurveySchema
  }, updateSurvey as any);

  // Export sessions as CSV
  fastify.get<ExportSessionsCSVRequest>('/export/csv', {
    schema: exportSessionsCSVSchema,
    preHandler: [adminAuthMiddleware],
  }, exportSessionsCSV);

  // Export surveillance forms as CSV
  fastify.get<ExportSurveillanceFormsCSVRequest>('/export/surveillance-forms/csv', {
    schema: exportSurveillanceFormsCSVSchema,
    preHandler: [adminAuthMiddleware],
  }, exportSurveillanceFormsCSV);

  done();
} 