import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { HookHandlerDoneFunction } from 'fastify';
import { UserWhitelist } from '../db/models';

interface JwtPayload {
  userId: number;
  email: string;
  privilege: number;
}

// Extend FastifyRequest to include unified auth info
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number;
      email: string;
      isWhitelisted: boolean;
      privilege: number;
    };
    isAdminToken?: boolean;
    isMobileApp?: boolean;
    authType?: 'admin' | 'user' | 'mobile' | 'none';
  }
}

/**
 * Unified authentication middleware that checks for all possible auth types
 * Priority order: admin token -> user JWT -> mobile token
 * Fills in appropriate user info based on token type
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers['authorization'];

  // If no auth header, mark as unauthenticated and continue
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    request.authType = 'none';
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  // 1. First check for admin token
  const expectedAdminToken = config.adminAuthToken;
  if (expectedAdminToken && token === expectedAdminToken) {
    request.isAdminToken = true;
    request.authType = 'admin';
    // Admin token doesn't provide specific user info, just admin access
    return;
  }

  // 2. Then check for user JWT token
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    request.user = {
      id: decoded.userId,
      email: decoded.email,
      isWhitelisted: false,
      privilege: decoded.privilege,
    };
    
      try {
        const userWhitelist = await UserWhitelist.findOne({ where: { email: decoded.email } });
        // Set user info on request object
        request.user.isWhitelisted = !!userWhitelist;
        request.authType = 'user';
        return;
      } catch (dbError) {
        request.authType = 'user';
        return;
      }
  } catch (jwtError) {
    // JWT verification failed, continue to mobile token check
  }

  // 3. Finally check for mobile token
  if (token === config.mobileAuthToken) {
    request.isMobileApp = true;
    request.authType = 'mobile';
    // Mobile token doesn't provide specific user info, just mobile app access
    return;
  }

  // 4. If none of the above tokens are valid, mark as unauthenticated
  request.authType = 'none';
}

/**
 * Middleware to require any form of authentication
 * Use this when you need to ensure the request is authenticated but don't care about the type
 */
export function requireAnyAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  if (request.authType === 'none') {
    reply.code(401).send({ error: 'Unauthorized: Authentication required' });
    return done(new Error('Unauthorized'));
  }
  
  done();
}

/**
 * Middleware to require admin authentication specifically
 */
export function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  if (!request.isAdminToken) {
    reply.code(401).send({ error: 'Unauthorized: Admin token required' });
    return done(new Error('Unauthorized'));
  }
  
  done();
}

/**
 * Middleware to require user JWT authentication specifically
 */
export function requireUserAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  if (request.authType !== 'user' || !request.user || !request.user.isWhitelisted) {
    reply.code(401).send({ error: 'Unauthorized: User authentication required' });
    return done(new Error('Unauthorized'));
  }
  
  done();
}

/**
 * Middleware to require user JWT authentication without whitelist check
 */
export function requireNonWhitelistedUserAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  if (request.authType !== 'user' || !request.user) {
    reply.code(401).send({ error: 'Unauthorized: User authentication required' });
    return done(new Error('Unauthorized'));
  }
  
  done();
}

/**
 * Middleware to require mobile authentication specifically
 */
export function requireMobileAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  if (!request.isMobileApp) {
    reply.code(401).send({ error: 'Unauthorized: Mobile token required' });
    return done(new Error('Unauthorized'));
  }
  
  done();
}

/**
 * Middleware to require admin privileges (for user JWT tokens with privilege >= 1)
 */
export function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  // Admin token always has admin privileges
  if (request.isAdminToken) {
    return done();
  }

  // For user tokens, check privilege level
  if (!request.user || request.user.privilege < 1) {
    reply.code(403).send({ error: 'Forbidden: Admin privileges required' });
    return done(new Error('Forbidden'));
  }

  done();
}

/**
 * Middleware to require superadmin privileges (for user JWT tokens with privilege >= 2)
 */
export function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  // Admin token always has superadmin privileges
  if (request.isAdminToken) {
    return done();
  }

  // For user tokens, check privilege level
  if (!request.user || request.user.privilege < 2) {
    reply.code(403).send({ error: 'Forbidden: Superadmin privileges required' });
    return done(new Error('Forbidden'));
  }

  done();
}
