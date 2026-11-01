import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { sentryService } from '../services/sentry.service';

function denyUnlessAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  const isDeveloperUser = request.authType === 'user' && !!request.user?.isDeveloper;
  if (!request.isAdminToken && !isDeveloperUser) {
    reply.code(401).send({ error: 'Unauthorized: Admin token or developer user required' });
    return true;
  }
  return false;
}

export default async function testSentryRoutes(fastify: FastifyInstance) {
  // Sends a crash-tagged event and returns success. Does not stop the server.
  fastify.get('/test-sentry', async (request, reply) => {
    if (denyUnlessAdmin(request, reply)) {
      return;
    }

    const message = `Sentry alert test crash ${new Date().toISOString()}`;
    const recorded = sentryService.captureCrash(new Error(message), { context: 'sentry_alert_test' });
    if (!recorded) {
      return reply.code(503).send({ error: 'Sentry is not initialized. Set SENTRY_DSN and restart.' });
    }

    await sentryService.flush(2000);
    return {
      success: true,
      recorded: true,
      message,
      timestamp: new Date().toISOString(),
    };
  });

  // Throws a 500 so the 5xx email alert fires.
  fastify.get('/test-sentry-error', async (request, reply) => {
    if (denyUnlessAdmin(request, reply)) {
      return;
    }

    throw new Error(`Sentry alert test 5xx ${new Date().toISOString()}`);
  });

  // Test route to test performance monitoring
  fastify.get('/test-sentry-performance', async (request, reply) => {
    if (denyUnlessAdmin(request, reply)) {
      return;
    }

    const start = Date.now();
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const duration = Date.now() - start;
    
    request.log.info(`Performance test completed in ${duration}ms`);
    
    return {
      success: true,
      duration,
      message: 'Performance test completed'
    };
  });
} 