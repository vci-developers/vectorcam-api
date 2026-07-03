import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware';
import { signedUrlMiddleware } from '../middleware/signedUrl.middleware';
import exportRoutes from './export';
import programRoutes from './programs';
import siteRoutes from './sites';
import deviceRoutes from './devices';
import sessionRoutes from './sessions';
import specimenRoutes from './specimens';
import healthRoutes from './health';
import testSentryRoutes from './test-sentry';
import testRoutes from './test';
import authRoutes from './auth';
import userRoutes from './users';
import annotationRoutes from './annotations';
import dhis2Routes from './dhis2';
import vectorAiRoutes from './vector-ai';

/**
 * Register all routes with the Fastify instance
 */
export default async function routes(server: FastifyInstance): Promise<void> {
  // Register unified auth middleware globally
  server.addHook('preHandler', authMiddleware);
  server.addHook('preHandler', signedUrlMiddleware);
  
  // Register health check routes at root level
  server.register(healthRoutes);
  
  server.register(authRoutes, { prefix: '/auth' });
  server.register(userRoutes, { prefix: '/users' });
  server.register(programRoutes, { prefix: '/programs' });
  server.register(siteRoutes, { prefix: '/sites' });
  server.register(deviceRoutes, { prefix: '/devices' });
  server.register(sessionRoutes, { prefix: '/sessions' });
  server.register(specimenRoutes, { prefix: '/specimens' });
  server.register(annotationRoutes, { prefix: '/annotations' });
  server.register(exportRoutes, { prefix: '/export' });
  server.register(dhis2Routes, { prefix: '/dhis2' });
  server.register(vectorAiRoutes, { prefix: '/vector-ai' });
  
  // Register test routes
  server.register(testRoutes, { prefix: '/test' });
  
  // Register Sentry test routes (only in development)
  if (process.env.NODE_ENV === 'development') {
    server.register(testSentryRoutes, { prefix: '/test-sentry' });
  }
} 