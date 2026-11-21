import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getAnnotationTaskList,
  getAnnotationTask,
  updateAnnotationTask,
  deleteAnnotationTask,
  createAnnotationTasks,
  createManualAnnotationTask,
  bulkAddAnnotations,
  bulkDeleteAnnotations,
} from '../handlers/annotation-task';
import { getAnnotationList, getAnnotationSummary, getAnnotation, updateAnnotation, exportAnnotationsCSV } from '../handlers/annotation';

// Import schemas from handler files
import { schema as getAnnotationTaskListSchema } from '../handlers/annotation-task/getList';
import { schema as getAnnotationTaskSchema } from '../handlers/annotation-task/get';
import { schema as updateAnnotationTaskSchema } from '../handlers/annotation-task/put';
import { schema as deleteAnnotationTaskSchema } from '../handlers/annotation-task/delete';
import { schema as createAnnotationTasksSchema } from '../handlers/annotation-task/post';
import { schema as createManualAnnotationTaskSchema } from '../handlers/annotation-task/postManual';
import { schema as bulkAddAnnotationsSchema } from '../handlers/annotation-task/postAnnotations';
import { schema as bulkDeleteAnnotationsSchema } from '../handlers/annotation-task/deleteAnnotations';
import { schema as getAnnotationListSchema } from '../handlers/annotation/getList';
import { schema as getAnnotationSummarySchema } from '../handlers/annotation/getSummary';
import { schema as getAnnotationSchema } from '../handlers/annotation/get';
import { schema as updateAnnotationSchema } from '../handlers/annotation/put';
import { schema as exportAnnotationsSchema } from '../handlers/annotation/export';
import { requirePermission } from '../middleware/permission.middleware';
import { requireSignedResourceAuth } from '../middleware/signedUrl.middleware';

// Handlers narrow these further: annotators see their own tasks, readers and managers see their program's.
const requireAnnotationAccess = requirePermission(['annotation:annotate', 'annotation:read', 'annotation:manage']);
const requireAnnotationWork = requirePermission(['annotation:annotate', 'annotation:manage']);
const requireAnnotationResults = requirePermission(['annotation:read', 'annotation:manage']);
const requireAnnotationManage = requirePermission('annotation:manage');

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  
  // Annotation Task endpoints (under /task)
  
  fastify.get('/task', {
    preHandler: [requireAnnotationAccess],
    schema: getAnnotationTaskListSchema
  }, getAnnotationTaskList as any);

  fastify.get('/task/:annotationTaskId', {
    preHandler: [requireAnnotationAccess],
    schema: getAnnotationTaskSchema
  }, getAnnotationTask as any);

  // Create annotation tasks for unassigned specimens
  fastify.post('/task', {
    preHandler: [requireAnnotationManage],
    schema: createAnnotationTasksSchema
  }, createAnnotationTasks as any);

  // Create an empty annotation task manually
  fastify.post('/task/manual', {
    preHandler: [requireAnnotationManage],
    schema: createManualAnnotationTaskSchema
  }, createManualAnnotationTask as any);

  // Bulk add specimens as empty annotations to a task
  fastify.post('/task/:taskId/annotations', {
    preHandler: [requireAnnotationManage],
    schema: bulkAddAnnotationsSchema
  }, bulkAddAnnotations as any);

  // Bulk delete annotations from a task
  fastify.delete('/task/:taskId/annotations', {
    preHandler: [requireAnnotationManage],
    schema: bulkDeleteAnnotationsSchema
  }, bulkDeleteAnnotations as any);

  // Update annotation task (annotators: status of their own tasks only)
  fastify.put('/task/:taskId', {
    preHandler: [requireAnnotationWork],
    schema: updateAnnotationTaskSchema
  }, updateAnnotationTask as any);

  // Delete annotation task
  fastify.delete('/task/:taskId', {
    preHandler: [requireAnnotationManage],
    schema: deleteAnnotationTaskSchema
  }, deleteAnnotationTask as any);

  // Annotation endpoints (root level)
  
  fastify.get('/', {
    preHandler: [requireAnnotationAccess],
    schema: getAnnotationListSchema
  }, getAnnotationList as any);

  // Get annotation status summary
  fastify.get('/summary', {
    preHandler: [requireAnnotationResults],
    schema: getAnnotationSummarySchema
  }, getAnnotationSummary as any);

  // Export annotations to CSV (annotation:read, or a signed URL)
  fastify.get('/export', {
    preHandler: [requireSignedResourceAuth],
    schema: exportAnnotationsSchema
  }, exportAnnotationsCSV as any);

  // Get single annotation with related data
  fastify.get('/:annotationId', {
    preHandler: [requireAnnotationAccess],
    schema: getAnnotationSchema
  }, getAnnotation as any);

  // Update annotation (annotators: annotations in their own tasks only)
  fastify.put('/:annotationId', {
    preHandler: [requireAnnotationWork],
    schema: updateAnnotationSchema
  }, updateAnnotation as any);

  done();
}
