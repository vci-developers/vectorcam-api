import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAnnotationTaskList, updateAnnotationTask, deleteAnnotationTask, createAnnotationTasks } from '../handlers/annotation-task';
import { getAnnotationList, getAnnotation, updateAnnotation } from '../handlers/annotation';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware';
import { requireWhitelisted } from '../middleware/auth.middleware';

// Import schemas from handler files
import { schema as getAnnotationTaskListSchema } from '../handlers/annotation-task/getList';
import { schema as updateAnnotationTaskSchema } from '../handlers/annotation-task/put';
import { schema as deleteAnnotationTaskSchema } from '../handlers/annotation-task/delete';
import { schema as createAnnotationTasksSchema } from '../handlers/annotation-task/post';
import { schema as getAnnotationListSchema } from '../handlers/annotation/getList';
import { schema as getAnnotationSchema } from '../handlers/annotation/get';
import { schema as updateAnnotationSchema } from '../handlers/annotation/put';

/**
 * Flexible authentication middleware that supports both adminAuth token and user authentication
 * Sets a flag to indicate which auth method was used
 * For JWT users, also checks if their email is whitelisted
 */
async function flexibleAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers['authorization'];
  const expectedAdminToken = process.env.ADMIN_AUTH_TOKEN;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  
  // Check if it's an admin token first
  if (expectedAdminToken && token === expectedAdminToken) {
    request.isAdminToken = true;
    return; // Continue to next handler
  }
  
  // Otherwise, try JWT authentication
  try {
    const jwt = require('jsonwebtoken');
    const { config } = require('../config/environment');
    const decoded = jwt.verify(token, config.jwt.secret);
    
    request.user = {
      id: decoded.userId,
      email: decoded.email,
      privilege: decoded.privilege,
    };
    request.isAdminToken = false;
    
    // Check if user email is whitelisted using existing middleware
    await requireWhitelisted(request, reply);
    
    // Only superadmin users (privilege = 2) can access
    if (request.user.privilege !== 2) {
      return reply.code(403).send({ error: 'Forbidden: Only superadmin users or admin token can access annotations' });
    }
  } catch (error) {
    return reply.code(401).send({ error: 'Unauthorized: Invalid token' });
  }
}

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  
  // Annotation Task endpoints (under /task)
  
  // Get annotation tasks list
  // Admin token: all tasks, Superadmin user: only their own tasks
  fastify.get('/task', {
    preHandler: [flexibleAuth],
    schema: getAnnotationTaskListSchema
  }, getAnnotationTaskList as any);

  // Create annotation tasks for unassigned specimens (admin token only)
  fastify.post('/task', {
    preHandler: [adminAuthMiddleware],
    schema: createAnnotationTasksSchema
  }, createAnnotationTasks as any);

  // Update annotation task (admin token and superadmin user)
  fastify.put('/task/:taskId', {
    preHandler: [flexibleAuth],
    schema: updateAnnotationTaskSchema
  }, updateAnnotationTask as any);

  // Delete annotation task (admin token only)
  fastify.delete('/task/:taskId', {
    preHandler: [adminAuthMiddleware],
    schema: deleteAnnotationTaskSchema
  }, deleteAnnotationTask as any);

  // Annotation endpoints (root level)
  
  // Get annotations list (admin token and superadmin user)
  fastify.get('/', {
    preHandler: [flexibleAuth],
    schema: getAnnotationListSchema
  }, getAnnotationList as any);

  // Get single annotation with related data (admin token and superadmin user)
  fastify.get('/:annotationId', {
    preHandler: [flexibleAuth],
    schema: getAnnotationSchema
  }, getAnnotation as any);

  // Update annotation (admin token and superadmin user)
  fastify.put('/:annotationId', {
    preHandler: [flexibleAuth],
    schema: updateAnnotationSchema
  }, updateAnnotation as any);

  done();
}
