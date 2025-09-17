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
  // Get the status code from the error, default to 500 for server errors
  const statusCode = (error as any).statusCode || 500;
  
  // Add error context for Sentry
  sentryService.setContext('error', {
    message: error.message,
    stack: error.stack,
    statusCode,
    url: request.url,
    method: request.method,
    code: (error as any).code,
    validation: (error as any).validation,
  });

  // Capture ALL errors in Sentry (both 4xx and 5xx)
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
      statusCode,
      headers: reply.getHeaders(),
    },
  });

  // Handle client errors (4xx) - log at info level and return detailed response
  if (statusCode >= 400 && statusCode < 500) {
    // Log client errors at info level
    request.log.info({
      error: error.message,
      statusCode,
      url: request.url,
      method: request.method,
      code: (error as any).code,
      validation: (error as any).validation,
    }, 'Client error captured by Sentry');
    
    // Prepare response object
    const response: any = {
      error: error.message || 'Client error'
    };
    
    // Add validation details if it's a validation error
    if ((error as any).validation) {
      response.validation = (error as any).validation;
    }
    
    // Return the error response to the client
    return reply.status(statusCode).send(response);
  }

  // Handle server errors (5xx) - log as error and return generic response
  request.log.error(error, 'Server error captured by Sentry');
  
  // Return a generic server error response
  return reply.status(statusCode).send({
    error: 'Internal server error'
  });
} 