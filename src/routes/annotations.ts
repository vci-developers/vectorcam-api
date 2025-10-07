import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAnnotationTaskList, updateAnnotationTask, deleteAnnotationTask, createAnnotationTasks } from '../handlers/annotation-task';
import { getAnnotationList, getAnnotation, updateAnnotation, exportAnnotationsCSV } from '../handlers/annotation';

// Import schemas from handler files
import { schema as getAnnotationTaskListSchema } from '../handlers/annotation-task/getList';
import { schema as updateAnnotationTaskSchema } from '../handlers/annotation-task/put';
import { schema as deleteAnnotationTaskSchema } from '../handlers/annotation-task/delete';
import { schema as createAnnotationTasksSchema } from '../handlers/annotation-task/post';
import { schema as getAnnotationListSchema } from '../handlers/annotation/getList';
import { schema as getAnnotationSchema } from '../handlers/annotation/get';
import { schema as updateAnnotationSchema } from '../handlers/annotation/put';
import { schema as exportAnnotationsSchema } from '../handlers/annotation/export';
import { requireAdminAuth, requireSuperAdmin } from '../middleware/auth.middleware';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  
  // Annotation Task endpoints (under /task)
  
  // Get annotation tasks list
  // Admin token: all tasks, Superadmin user: only their own tasks
  fastify.get('/task', {
    preHandler: [requireSuperAdmin],
    schema: getAnnotationTaskListSchema
  }, getAnnotationTaskList as any);

  // Create annotation tasks for unassigned specimens (admin token only)
  fastify.post('/task', {
    preHandler: [requireAdminAuth],
    schema: createAnnotationTasksSchema
  }, createAnnotationTasks as any);

  // Update annotation task (admin token and superadmin user)
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
  
  // Get annotations list (admin token and superadmin user)
  fastify.get('/', {
    preHandler: [requireSuperAdmin],
    schema: getAnnotationListSchema
  }, getAnnotationList as any);

  // Export annotations to CSV (admin token and superadmin user)
  fastify.get('/export', {
    preHandler: [requireAdminAuth],
    schema: exportAnnotationsSchema
  }, exportAnnotationsCSV as any);

  // Get single annotation with related data (admin token and superadmin user)
  fastify.get('/:annotationId', {
    preHandler: [requireSuperAdmin],
    schema: getAnnotationSchema
  }, getAnnotation as any);

  // Update annotation (admin token and superadmin user)
  fastify.put('/:annotationId', {
    preHandler: [requireSuperAdmin],
    schema: updateAnnotationSchema
  }, updateAnnotation as any);

  done();
}
