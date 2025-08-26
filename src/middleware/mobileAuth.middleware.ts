import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/environment';
import { HookHandlerDoneFunction } from 'fastify';

// Extend FastifyRequest to include mobile app info
declare module 'fastify' {
  interface FastifyRequest {
    isMobileApp?: boolean;
    // user is already declared in auth.middleware.ts
  }
}

/**
 * Middleware to authenticate mobile app requests using a static token
 * Expects header: Authorization: Bearer <mobile_auth_token>
 * This is a simpler authentication method specifically for mobile apps
 */
export function mobileAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  const authHeader = request.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return done(new Error('Unauthorized'));
  }

  const token = authHeader.slice('Bearer '.length).trim();

  // Validate mobile auth token
  if (token !== config.mobileAuthToken) {
    reply.code(401).send({ error: 'Unauthorized: Invalid mobile auth token' });
    return done(new Error('Unauthorized'));
  }

  // Mark request as coming from mobile app
  request.isMobileApp = true;

  done();
}

/**
 * Middleware that accepts either regular JWT auth or mobile app auth
 * This allows endpoints to be accessible by both web users and mobile apps
 */
export function flexibleAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  const authHeader = request.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return done(new Error('Unauthorized'));
  }

  const token = authHeader.slice('Bearer '.length).trim();

  // First, try mobile auth token
  if (token === config.mobileAuthToken) {
    request.isMobileApp = true;
    return done();
  }

  // If not mobile token, try JWT validation
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    // Set user info on request object (for JWT auth)
    request.user = {
      id: decoded.userId,
      email: decoded.email,
      privilege: decoded.privilege,
    };

    done();
  } catch (error) {
    reply.code(401).send({ error: 'Unauthorized: Invalid token' });
    return done(new Error('Unauthorized'));
  }
}
