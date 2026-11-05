import { FastifyReply, FastifyRequest } from 'fastify';
import { sentryService } from '../services/sentry.service';
import {
  httpEventMessage,
  isBotNoise,
  isExpectedClientResponse,
  responseErrorText,
  routeTemplate,
  shouldRecordHttpStatus,
} from '../services/sentry-http';
import { takeRequestError } from '../services/sentry-request-errors';

const capturedRequests = new WeakSet<FastifyRequest>();

export async function sentryOnSend(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown
): Promise<unknown> {
  const statusCode = reply.statusCode;
  const loggedError = takeRequestError(String(request.id));
  if (capturedRequests.has(request) || !shouldRecordHttpStatus(statusCode)) {
    return payload;
  }
  // Mark the request as handled so the error handler does not report it a second time
  // (auth middleware sends a 401/403 and then also passes an Error to done()).
  capturedRequests.add(request);
  if (isBotNoise(request)) {
    return payload;
  }

  const route = routeTemplate(request.routeOptions?.url, request.url);
  if (isExpectedClientResponse({ statusCode, method: request.method, route, isMobileApp: request.isMobileApp })) {
    return payload;
  }

  const detail = responseErrorText(payload);
  sentryService.captureHttpStatus({
    statusCode,
    method: request.method,
    route,
    url: request.url,
    headers: request.headers,
    requestBody: request.body,
    responseBody: payload,
    message: httpEventMessage(statusCode, request.method, route, detail),
    error: statusCode >= 500 ? loggedError : undefined,
    user: request.user,
  });

  return payload;
}

export async function sentryErrorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // A response was already sent for this request (e.g. auth middleware replied 401/403 and
  // then called done(new Error(...))). onSend has already reported or skipped it, so do not
  // report the same request again as a 500.
  if (capturedRequests.has(request)) {
    takeRequestError(String(request.id));
    return;
  }

  const statusCode = (error as { statusCode?: number }).statusCode || 500;
  capturedRequests.add(request);
  takeRequestError(String(request.id));

  const route = routeTemplate(request.routeOptions?.url, request.url);
  const expected = isExpectedClientResponse({
    statusCode,
    method: request.method,
    route,
    isMobileApp: request.isMobileApp,
  });
  const responseBody = statusCode >= 500
    ? { error: 'Internal server error' }
    : {
        error: error.message || 'Client error',
        ...((error as { validation?: unknown }).validation
          ? { validation: (error as { validation?: unknown }).validation }
          : {}),
      };
  if (!expected) {
    sentryService.captureHttpStatus({
      statusCode,
      method: request.method,
      route,
      url: request.url,
      headers: request.headers,
      requestBody: request.body,
      responseBody,
      message: httpEventMessage(statusCode, request.method, route, error.message),
      error,
      user: request.user,
    });
  }

  if (statusCode >= 400 && statusCode < 500) {
    request.log.info({
      error: error.message,
      statusCode,
      url: request.url,
      method: request.method,
      code: (error as { code?: string }).code,
      validation: (error as { validation?: unknown }).validation,
    }, 'Client error captured by Sentry');

    const response: { error: string; validation?: unknown } = {
      error: error.message || 'Client error',
    };
    if ((error as { validation?: unknown }).validation) {
      response.validation = (error as { validation?: unknown }).validation;
    }
    return reply.status(statusCode).send(response);
  }

  request.log.error(error, 'Server error captured by Sentry');
  return reply.status(statusCode).send({
    error: 'Internal server error',
  });
}
