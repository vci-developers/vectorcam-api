import { FastifyInstance } from 'fastify';
import healthRoutes from './health';
import deviceRoutes from './devices';
import siteRoutes from './sites';
import healthCenterRoutes from './healthcenters';
import sessionRoutes from './sessions';
import specimenRoutes from './specimens';
// Import other route modules here when they are created

/**
 * Register all routes with the Fastify instance
 */
export default function registerRoutes(server: FastifyInstance): void {
  // Register health check routes
  server.register(healthRoutes, { prefix: '/health' });
  
  // Basic root endpoint
  server.get('/', async (request, reply) => {
    return { message: 'Welcome to VectorCam API' };
  });

  // Register API endpoints
  server.register(deviceRoutes, { prefix: '/devices' });
  server.register(siteRoutes, { prefix: '/sites' });
  server.register(healthCenterRoutes, { prefix: '/healthcenters' });
  server.register(sessionRoutes, { prefix: '/sessions' });
  server.register(specimenRoutes, { prefix: '/specimens' });
} 