import { FastifyInstance } from 'fastify';
import { sentryService } from '../services/sentry.service';

export default async function testSentryRoutes(fastify: FastifyInstance) {
  // Test route to verify Sentry is working
  fastify.get('/test-sentry', async (request, reply) => {
    try {
      // Test different types of logging
      request.log.info('Testing Sentry info logging');
      request.log.warn('Testing Sentry warning logging');
      request.log.debug('Testing Sentry debug logging');

      // Test manual Sentry capture
      sentryService.captureMessage('Test message from API', 'info', {
        extra: { test: true, route: '/test-sentry' }
      });

      // Test breadcrumb
      sentryService.addBreadcrumb({
        category: 'test',
        message: 'Test breadcrumb added',
        level: 'info',
        data: { testRoute: true }
      });

      return {
        success: true,
        message: 'Sentry test completed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      request.log.error('Error in test-sentry route:', error);
      throw error;
    }
  });

  // Test route to trigger an error
  fastify.get('/test-sentry-error', async (request, reply) => {
    // This will trigger the error handler and be captured by Sentry
    throw new Error('Test error for Sentry capture');
  });

  // Test route to test performance monitoring
  fastify.get('/test-sentry-performance', async (request, reply) => {
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