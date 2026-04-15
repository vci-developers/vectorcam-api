import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAnnotationTaskList, getAnnotationTask, updateAnnotationTask, deleteAnnotationTask, createAnnotationTasks } from '../handlers/annotation-task';
import { getAnnotationList, getAnnotationSummary, getAnnotation, updateAnnotation, exportAnnotationsCSV } from '../handlers/annotation';

// Import schemas from handler files
import { schema as getAnnotationTaskListSchema } from '../handlers/annotation-task/getList';
import { schema as getAnnotationTaskSchema } from '../handlers/annotation-task/get';
import { schema as updateAnnotationTaskSchema } from '../handlers/annotation-task/put';
import { schema as deleteAnnotationTaskSchema } from '../handlers/annotation-task/delete';
import { schema as createAnnotationTasksSchema } from '../handlers/annotation-task/post';
import { schema as getAnnotationListSchema } from '../handlers/annotation/getList';
import { schema as getAnnotationSummarySchema } from '../handlers/annotation/getSummary';
import { schema as getAnnotationSchema } from '../handlers/annotation/get';
import { schema as updateAnnotationSchema } from '../handlers/annotation/put';
import { schema as exportAnnotationsSchema } from '../handlers/annotation/export';
import { requireAdminAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth.middleware';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  
  // Annotation Task endpoints (under /task)
  
  // Get annotation tasks list
  // Admin token: all tasks, admin user: only their own tasks
  fastify.get('/task', {
    preHandler: [requireSuperAdmin],
    schema: getAnnotationTaskListSchema
  }, getAnnotationTaskList as any);

  // Get annotation task details
  // Admin token: any task, admin user: only their own task
  fastify.get('/task/:annotationTaskId', {
    preHandler: [requireSuperAdmin],
    schema: getAnnotationTaskSchema
  }, getAnnotationTask as any);

  // Create annotation tasks for unassigned specimens (admin token only)
  fastify.post('/task', {
    preHandler: [requireAdminAuth],
    schema: createAnnotationTasksSchema
  }, createAnnotationTasks as any);

  // Update annotation task (admin token and admin user)
  fastify.put('/task/:taskId', {
    preHandler: [requireSuperAdmin],
    schema: updateAnnotationTaskSchema
  }, updateAnnotationTask as any);

  // Delete annotation task (admin token only)
  fastify.delete('/task/:taskId', {
    preHandler: [requireAdminAuth],
    schema: deleteAnnotationTaskSchema
  }, deleteAnnotationTask as any);

  // Annotation endpoints (root level)
  
  // Get annotations list (admin token and admin user)
  fastify.get('/', {
    preHandler: [requireSuperAdmin],
    schema: getAnnotationListSchema
  }, getAnnotationList as any);

  // Get annotation status summary (admin token and admin user)
  fastify.get('/summary', {
    preHandler: [requireSuperAdmin],
    schema: getAnnotationSummarySchema
  }, getAnnotationSummary as any);

  // Export annotations to CSV (admin token)
  fastify.get('/export', {
    preHandler: [requireSuperAdmin],
    schema: exportAnnotationsSchema
  }, exportAnnotationsCSV as any);

  // Get single annotation with related data (admin token)
  fastify.get('/:annotationId', {
    preHandler: [requireSuperAdmin],
    schema: getAnnotationSchema
  }, getAnnotation as any);

  // Update annotation (admin token)
  fastify.put('/:annotationId', {
    preHandler: [requireSuperAdmin],
    schema: updateAnnotationSchema
  }, updateAnnotation as any);

  done();
}
