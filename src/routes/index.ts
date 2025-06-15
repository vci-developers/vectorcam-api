import { FastifyInstance } from 'fastify';
import programRoutes from './programs';
import siteRoutes from './sites';
import deviceRoutes from './devices';
import sessionRoutes from './sessions';
import specimenRoutes from './specimens';

/**
 * Register all routes with the Fastify instance
 */
export default async function routes(server: FastifyInstance): Promise<void> {
  // Register routes
  server.register(programRoutes, { prefix: '/programs' });
  server.register(siteRoutes, { prefix: '/sites' });
  server.register(deviceRoutes, { prefix: '/devices' });
  server.register(sessionRoutes, { prefix: '/sessions' });
  server.register(specimenRoutes, { prefix: '/specimens' });
} 