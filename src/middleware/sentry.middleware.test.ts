import Fastify, { FastifyInstance, FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';

const captureHttpStatus = jest.fn();

jest.mock('../services/sentry.service', () => ({
  sentryService: { captureHttpStatus: (...args: unknown[]) => captureHttpStatus(...args) },
}));

import { sentryErrorHandler, sentryOnSend } from './sentry.middleware';

function requireAuth(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void {
  // Same shape as auth.middleware: send the response, then also pass an Error to done()
  reply.code(401).send({ error: 'Unauthorized: Authentication required' });
  return done(new Error('Unauthorized'));
}

function requireAdmin(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void {
  reply.code(403).send({ error: 'Forbidden: Admin privileges required' });
  return done(new Error('Forbidden'));
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  app.addHook('onRequest', async (request) => {
    if (request.headers.authorization === 'Bearer mobile') {
      request.isMobileApp = true;
    }
  });
  app.get('/sessions/:session_id', async (request, reply) => reply.code(404).send({ error: 'Session not found' }));
  app.get('/sessions/:session_id/survey', async (request, reply) => reply.code(404).send({ error: 'not found' }));
  app.get('/programs/:program_id/forms/current', async (request, reply) => reply.code(404).send({ error: 'No form' }));
  app.post('/sessions/:session_id/forms/answers', async (request, reply) => reply.code(400).send({ error: 'bad answers' }));
  app.get('/protected', { preHandler: requireAuth }, async () => ({ ok: true }));
  app.get('/admin-only', { preHandler: requireAdmin }, async () => ({ ok: true }));
  app.get('/boom', async () => {
    throw new Error('database exploded');
  });
  app.addHook('onSend', sentryOnSend);
  app.setErrorHandler(sentryErrorHandler);
  await app.ready();
  return app;
}

describe('sentry http capture', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    captureHttpStatus.mockClear();
  });

  it('skips unmatched routes (bot scans)', async () => {
    const res = await app.inject('/.env');
    expect(res.statusCode).toBe(404);
    expect(captureHttpStatus).not.toHaveBeenCalled();
  });

  it('skips mobile-token 404s on existence-check routes', async () => {
    const headers = { authorization: 'Bearer mobile' };
    expect((await app.inject({ url: '/sessions/abc', headers })).statusCode).toBe(404);
    expect((await app.inject({ url: '/sessions/4/survey', headers })).statusCode).toBe(404);
    expect(captureHttpStatus).not.toHaveBeenCalled();
  });

  it('still records the same 404s without the mobile token', async () => {
    await app.inject('/sessions/abc');
    expect(captureHttpStatus).toHaveBeenCalledTimes(1);
    expect(captureHttpStatus.mock.calls[0][0]).toMatchObject({ statusCode: 404, route: '/sessions/:session_id' });
  });

  it('still records other mobile-token 404s', async () => {
    await app.inject({ url: '/programs/7/forms/current', headers: { authorization: 'Bearer mobile' } });
    expect(captureHttpStatus).toHaveBeenCalledTimes(1);
    expect(captureHttpStatus.mock.calls[0][0]).toMatchObject({ statusCode: 404 });
  });

  it('skips 401 and does not report the follow-up Error as a 500', async () => {
    const res = await app.inject('/protected');
    expect(res.statusCode).toBe(401);
    expect(captureHttpStatus).not.toHaveBeenCalled();
  });

  it('records 403 once, as a 403 (not also as a 500 Error)', async () => {
    const res = await app.inject('/admin-only');
    expect(res.statusCode).toBe(403);
    expect(captureHttpStatus).toHaveBeenCalledTimes(1);
    expect(captureHttpStatus.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });

  it('records write-route 400s, including with the mobile token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sessions/1/forms/answers',
      payload: { answers: [] },
      headers: { authorization: 'Bearer mobile' },
    });
    expect(res.statusCode).toBe(400);
    expect(captureHttpStatus).toHaveBeenCalledTimes(1);
    expect(captureHttpStatus.mock.calls[0][0]).toMatchObject({
      statusCode: 400,
      route: '/sessions/:session_id/forms/answers',
    });
  });

  it('records thrown 5xx errors once', async () => {
    const res = await app.inject('/boom');
    expect(res.statusCode).toBe(500);
    expect(captureHttpStatus).toHaveBeenCalledTimes(1);
    expect(captureHttpStatus.mock.calls[0][0]).toMatchObject({ statusCode: 500 });
  });
});
