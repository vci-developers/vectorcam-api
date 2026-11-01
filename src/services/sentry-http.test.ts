import { httpEventMessage, loggedError, markUnhandledCrash, requestPath, responseErrorText, routeTemplate, sentryBody, sentryHeaders, shouldRecordHttpStatus } from './sentry-http';

describe('sentry http status capture', () => {
  it('records client and server responses only', () => {
    expect(shouldRecordHttpStatus(200)).toBe(false);
    expect(shouldRecordHttpStatus(302)).toBe(false);
    expect(shouldRecordHttpStatus(400)).toBe(true);
    expect(shouldRecordHttpStatus(404)).toBe(true);
    expect(shouldRecordHttpStatus(500)).toBe(true);
  });

  it('reads the error string from a JSON response', () => {
    expect(responseErrorText(JSON.stringify({ error: 'Workflow not found' }))).toBe('Workflow not found');
    expect(responseErrorText(Buffer.from(JSON.stringify({ message: 'Database connection failed' })))).toBe(
      'Database connection failed'
    );
    expect(responseErrorText('not-json')).toBeUndefined();
  });

  it('builds a stable event message from the route template', () => {
    expect(routeTemplate('/programs/:program_id/workflow', '/programs/4/workflow?x=1')).toBe(
      '/programs/:program_id/workflow'
    );
    expect(httpEventMessage(404, 'GET', '/programs/:program_id/workflow', 'Workflow not found')).toBe(
      'HTTP 404 GET /programs/:program_id/workflow: Workflow not found'
    );
  });

  it('tags an unhandled exception as a crash', () => {
    const event = {
      level: 'error',
      exception: { values: [{ mechanism: { handled: false } }] },
    };
    markUnhandledCrash(event);
    expect(event.tags?.crash).toBe('true');
    expect(event.level).toBe('fatal');
  });

  it('leaves a handled HTTP error unchanged', () => {
    const event = {
      level: 'error',
      tags: { http_status_code: '500' } as { [key: string]: unknown },
      exception: { values: [{ mechanism: { handled: true } }] },
    };
    markUnhandledCrash(event);
    expect(event.tags?.crash).toBeUndefined();
    expect(event.level).toBe('error');
  });

  it('keeps request details and redacts credentials', () => {
    expect(requestPath('/programs/4/workflow?token=secret')).toBe('/programs/4/workflow');
    expect(sentryHeaders({
      authorization: 'Bearer secret',
      cookie: 'session=abc',
      'content-type': 'application/json',
    })).toEqual({
      authorization: '[redacted]',
      cookie: '[redacted]',
      'content-type': 'application/json',
    });
    expect(sentryBody({ name: 'Ada', password: 'secret', nested: { refreshToken: 'abc' } })).toEqual({
      name: 'Ada',
      password: '[redacted]',
      nested: { refreshToken: '[redacted]' },
    });
    expect(sentryBody(JSON.stringify({ error: 'Workflow not found' }))).toEqual({ error: 'Workflow not found' });
  });

  it('finds the Error passed to a request logger', () => {
    const error = new Error('db down');
    expect(loggedError(error, [])).toBe(error);
    expect(loggedError({ err: error }, ['Vector AI inference request failed'])).toBe(error);
    expect(loggedError('Failed to get model from S3', [error])).toBe(error);
  });
});
