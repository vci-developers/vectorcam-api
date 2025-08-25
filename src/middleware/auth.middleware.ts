import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { UserWhitelist } from '../db/models';
import { HookHandlerDoneFunction } from 'fastify';

interface JwtPayload {
  userId: number;
  email: string;
  privilege: number;
}

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number;
      email: string;
      privilege: number;
    };
  }
}

/**
 * Middleware to authenticate requests using JWT tokens
 * Expects header: Authorization: Bearer <token>
 */
export function authMiddleware(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void {
  const authHeader = request.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return done(new Error('Unauthorized'));
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    
    // Set user info on request object
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

/**
 * Middleware to require admin privileges (privilege >= 1)
 */
export function requireAdmin(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void {
  if (!request.user) {
    reply.code(401).send({ error: 'Unauthorized: User not authenticated' });
    return done(new Error('Unauthorized'));
  }

  if (request.user.privilege < 1) {
    reply.code(403).send({ error: 'Forbidden: Admin privileges required' });
    return done(new Error('Forbidden'));
  }

  done();
}

/**
 * Middleware to require superadmin privileges (privilege >= 2)
 */
export function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void {
  if (!request.user) {
    reply.code(401).send({ error: 'Unauthorized: User not authenticated' });
    return done(new Error('Unauthorized'));
  }

  if (request.user.privilege < 2) {
    reply.code(403).send({ error: 'Forbidden: Superadmin privileges required' });
    return done(new Error('Forbidden'));
  }

  done();
}

/**
 * Middleware to require user email to be whitelisted
 * User must be authenticated first
 */
export function requireWhitelisted(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void {
  if (!request.user) {
    reply.code(401).send({ error: 'Unauthorized: User not authenticated' });
    return done(new Error('Unauthorized'));
  }

  // Check if user email is whitelisted
  UserWhitelist.findOne({ where: { email: request.user.email } })
    .then((whitelistEntry) => {
      if (!whitelistEntry) {
        reply.code(403).send({ error: 'Forbidden: User email is not whitelisted for this resource' });
        return done(new Error('Forbidden'));
      }
      done();
    })
    .catch((error) => {
      request.log.error('Error checking whitelist:', error);
      reply.code(500).send({ error: 'Internal server error' });
      return done(new Error('Internal server error'));
    });
}
