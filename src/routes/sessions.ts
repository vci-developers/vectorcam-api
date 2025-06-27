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
  createSurvey,
  updateSurvey
} from '../handlers/session';
import { getSessionList } from '../handlers/session/getList';

// Import schemas from handler files
import { schema as submitSchema } from '../handlers/session/post';
import { schema as getSchema } from '../handlers/session/get';
import { schema as updateSchema } from '../handlers/session/put';
import { schema as deleteSchema } from '../handlers/session/delete';
import { schema as getListSchema } from '../handlers/session/getList';
import { schema as getByUserSchema } from '../handlers/session/getByUser';
import { schema as getBySiteSchema } from '../handlers/session/getBySite';
import { schema as getSpecimensSchema } from '../handlers/session/getSpecimens';
import { schema as exportSessionsCSVSchema } from '../handlers/session/export';
import { schema as getSurveySchema } from '../handlers/session/survey/getSurvey';
import { schema as createSurveySchema } from '../handlers/session/survey/postSurvey';
import { schema as updateSurveySchema } from '../handlers/session/survey/putSurvey';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Get all sessions with comprehensive filters
  fastify.get('/', {
    schema: getListSchema
  }, getSessionList);

  // Submit a new session
  fastify.post('/', {
    schema: submitSchema
  }, submitSession);

  // Get session details by ID or frontendId (as string)
  fastify.get('/:session_id', {
    schema: getSchema
  }, getSessionDetails);

  // Update an existing session
  fastify.put('/:session_id', {
    schema: updateSchema
  }, updateSession);

  // Delete a session
  fastify.delete('/:session_id', {
    schema: deleteSchema
  }, deleteSession);

  // Get sessions by user
  fastify.get('/users/:user_id', {
    schema: getByUserSchema
  }, getSessionsByUser);

  // Get sessions by site
  fastify.get('/sites/:site_id', {
    schema: getBySiteSchema
  }, getSessionsBySite);

  // Get specimens for a session
  fastify.get('/:session_id/specimens', {
    schema: getSpecimensSchema
  }, getSessionSpecimens);

  // Get session surveillance form
  fastify.get('/:session_id/survey', {
    schema: getSurveySchema
  }, getSessionSurvey);

  // Create session surveillance form
  fastify.post('/:session_id/survey', {
    schema: createSurveySchema
  }, createSurvey);

  // Update session surveillance form
  fastify.put('/:session_id/survey', {
    schema: updateSurveySchema
  }, updateSurvey);

  // Export sessions as CSV
  fastify.get('/export/csv', {
    schema: exportSessionsCSVSchema
  }, exportSessionsCSV);

  done();
} 