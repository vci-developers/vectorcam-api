import { FastifyRequest, FastifyReply } from 'fastify';
import { sentryService } from '../services/sentry.service';

export async function sentryMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Add request context to Sentry
  sentryService.setContext('request', {
    method: request.method,
    url: request.url,
    headers: request.headers,
    query: request.query,
    params: request.params,
    body: request.body,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  });

  // Add breadcrumb for request
  sentryService.addBreadcrumb({
    category: 'http',
    type: 'http',
    level: 'info',
    message: `${request.method} ${request.url}`,
    data: {
      method: request.method,
      url: request.url,
      status_code: reply.statusCode,
    },
  });

  // Set user information if available (you can customize this based on your auth system)
  if ((request as any).user) {
    const user = (request as any).user;
    sentryService.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  }

  // Set tags for better filtering
  sentryService.setTag('route', (request as any).routerPath || request.url);
  sentryService.setTag('method', request.method);
}

export async function sentryErrorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Add error context
  sentryService.setContext('error', {
    message: error.message,
    stack: error.stack,
    statusCode: reply.statusCode,
    url: request.url,
    method: request.method,
  });

  // Capture the error in Sentry
  sentryService.captureException(error, {
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      query: request.query,
      params: request.params,
      body: request.body,
    },
    response: {
      statusCode: reply.statusCode,
      headers: reply.getHeaders(),
    },
  });

  // Log the error to the server logger as well
  request.log.error(error, 'Request error captured by Sentry');
} 