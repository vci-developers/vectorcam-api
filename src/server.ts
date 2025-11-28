import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config/environment';
import { testConnection } from './db';
import registerRoutes from './routes';
import { sentryService } from './services/sentry.service';
import { sentryMiddleware, sentryErrorHandler } from './middleware/sentry.middleware';
import { SentryLogger } from './utils/sentry-logger';

// Create Fastify instance with built-in logger options
const baseLogger = {
  level: config.server.logLevel || 'info',
  transport: config.server.nodeEnv !== 'production' 
    ? { target: 'pino-pretty' } 
    : undefined,
};

const server: FastifyInstance = Fastify({
  logger: baseLogger,
  trustProxy: true,
});

// Wrap the logger with Sentry integration
if (config.sentry?.enabled) {
  server.log = new SentryLogger(server.log);
}

// Register plugins
async function setupServer(): Promise<void> {
  try {
    // Initialize Sentry
    sentryService.init();
    
    // Test database connection
    await testConnection();
    
    // Register CORS
    await server.register(cors, {
      origin: true, // Or configure specific origins
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    });

    // Register Helmet for security headers
    await server.register(helmet, {
      // Customize security options if needed
      contentSecurityPolicy: false,
    });

    // Register Compression
    await server.register(compress);

    // Register Swagger
    await server.register(swagger, {
      swagger: {
        info: {
          title: 'VectorCam API',
          description: 'API documentation for VectorCam',
          version: '1.0.0'
        },
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          { name: 'Authentication', description: 'User authentication endpoints (signup, login, refresh)' },
          { name: 'Users', description: 'User profile and management endpoints' },
          { name: 'User Management', description: 'User whitelist management endpoints (admin only)' },
          { name: 'Programs', description: 'Program management endpoints' },
          { name: 'Sites', description: 'Site management endpoints' },
          { name: 'Devices', description: 'Device management endpoints' },
          { name: 'Sessions', description: 'Session management and surveillance form endpoints' },
          { name: 'Specimens', description: 'Specimen management endpoints' },
          { name: 'Specimen Images', description: 'Specimen image management and multipart upload endpoints' },
          { name: 'DHIS2', description: 'DHIS2 integration and data synchronization endpoints (admin only)' }
        ]
      }
    });

    // Register Swagger UI
    await server.register(swaggerUi, {
      routePrefix: '/documentation',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
        displayRequestDuration: true,
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        defaultModelsExpandDepth: 3,
        defaultModelExpandDepth: 3,
        displayOperationId: false,
        showExtensions: true,
        showCommonExtensions: true
      },
      staticCSP: true
    });

    // Register all routes
    registerRoutes(server);

    // Register Sentry middleware
    server.addHook('onRequest', sentryMiddleware);
    
    // Set the Sentry error handler to handle all errors properly
    server.setErrorHandler(sentryErrorHandler);

    // Start the server
    await server.listen({ 
      port: config.server.port,
      host: '0.0.0.0'
    });

    server.log.info(`Server started on port ${config.server.port} in ${config.server.nodeEnv} mode`);
  } catch (err) {
    console.log(err);
    server.log.error('Error starting server:', err);
    sentryService.captureException(err as Error, { context: 'server_startup' });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  server.log.info('SIGINT received, shutting down gracefully');
  await sentryService.flush(2000);
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  server.log.info('SIGTERM received, shutting down gracefully');
  await sentryService.flush(2000);
  await server.close();
  process.exit(0);
});

// Start the server
setupServer(); 