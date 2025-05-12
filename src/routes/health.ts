import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { testConnection } from '../db';
import { config } from '../config/environment';

export default async function healthRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Simple health check endpoint
  fastify.get('/', async (request, reply) => {
    return { 
      status: 'ok', 
      environment: config.server.nodeEnv,
      timestamp: new Date().toISOString() 
    };
  });

  // Database health check endpoint
  fastify.get('/db', async (request, reply) => {
    try {
      await testConnection();
      return { 
        status: 'ok', 
        message: 'Database connection is healthy',
        environment: config.server.nodeEnv,
        database: config.db.database,
        timestamp: new Date().toISOString() 
      };
    } catch (error) {
      fastify.log.error('Database health check failed', error);
      reply.code(500);
      return { 
        status: 'error', 
        message: 'Database connection failed',
        environment: config.server.nodeEnv,
        timestamp: new Date().toISOString() 
      };
    }
  });
} 