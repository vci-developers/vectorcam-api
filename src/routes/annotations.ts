import { FastifyInstance } from 'fastify';
import getAnnotationTaskList from '../handlers/annotation-task/getList';
import updateAnnotationTask from '../handlers/annotation-task/put';
import deleteAnnotationTask from '../handlers/annotation-task/delete';
import getAnnotationList from '../handlers/annotation/getList';
import getAnnotation from '../handlers/annotation/get';
import updateAnnotation from '../handlers/annotation/put';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware';

// Import schemas from handler files
import { schema as getAnnotationTaskListSchema } from '../handlers/annotation-task/getList';
import { schema as updateAnnotationTaskSchema } from '../handlers/annotation-task/put';
import { schema as deleteAnnotationTaskSchema } from '../handlers/annotation-task/delete';
import { schema as getAnnotationListSchema } from '../handlers/annotation/getList';
import { schema as getAnnotationSchema } from '../handlers/annotation/get';
import { schema as updateAnnotationSchema } from '../handlers/annotation/put';

/**
 * Flexible authentication middleware that supports both adminAuth token and user authentication
 * Sets a flag to indicate which auth method was used
 */
async function flexibleAuth(request: any, reply: any) {
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
    
    // Only superadmin users (privilege = 2) can access
    if (request.user.privilege !== 2) {
      return reply.code(403).send({ error: 'Forbidden: Only superadmin users or admin token can access annotations' });
    }
    
    return; // Continue to next handler
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
