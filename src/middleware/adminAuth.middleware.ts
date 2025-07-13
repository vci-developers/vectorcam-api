import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/environment';
import { HookHandlerDoneFunction } from 'fastify';

/**
 * Middleware to authenticate admin endpoints using a static token from env var ADMIN_AUTH_TOKEN.
 * Expects header: Authorization: Bearer <token>
 */
export function adminAuthMiddleware(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void {
  const authHeader = request.headers['authorization'];
  const expectedToken = process.env.ADMIN_AUTH_TOKEN || (config as any).adminAuthToken;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return done(new Error('Unauthorized'));
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!expectedToken || token !== expectedToken) {
    reply.code(401).send({ error: 'Unauthorized: Invalid admin token' });
    return done(new Error('Unauthorized'));
  }

  done();
} 