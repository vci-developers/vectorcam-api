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
    isAdminToken?: boolean;
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
export async function requireWhitelisted(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({ error: 'Unauthorized: User not authenticated' });
  }

  // Check if user email is whitelisted
  try {
    const whitelistEntry = await UserWhitelist.findOne({ where: { email: request.user.email } });
    if (!whitelistEntry) {
      return reply.code(403).send({ error: 'Forbidden: User email is not whitelisted for this resource' });
    }
    // If whitelisted, continue without sending a response (let the next handler take over)
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
