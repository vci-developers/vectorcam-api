import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { HookHandlerDoneFunction } from 'fastify';
import { UserWhitelist, User } from '../db/models';
import { recordUserActivity } from '../services/userActivity.service';

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
      isDeveloper: boolean;
      programId: number | null;
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

  // 2. Finally check for mobile token
  if (token === config.mobileAuthToken) {
    request.isMobileApp = true;
    request.authType = 'mobile';
    // Mobile token doesn't provide specific user info, just mobile app access
    return;
  }

  // 3. Then check for user JWT token
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Initialize user with token data, but we'll refresh privilege and programId from DB
    request.user = {
      id: decoded.userId,
      email: decoded.email,
      isWhitelisted: false,
      privilege: decoded.privilege, // Will be updated below
      isDeveloper: false, // Will be updated from DB below
      programId: null, // Will be updated from DB below
    };
    
    try {
      // Fetch current user data from database to get fresh privilege level and programId
      const [user, userWhitelist] = await Promise.all([
        User.findByPk(decoded.userId, { attributes: ['privilege', 'isDeveloper', 'programId'] }),
        UserWhitelist.findOne({ where: { email: decoded.email } })
      ]);
      
      if (user) {
        request.user.privilege = user.privilege;
        request.user.isDeveloper = user.isDeveloper;
        request.user.programId = user.programId;
      }
      
      request.user.isWhitelisted = !!userWhitelist;
      request.authType = 'user';
      recordUserActivity(decoded.userId);
      return;
    } catch (dbError) {
      // If DB query fails, use token values as fallback
      request.authType = 'user';
      return;
    }
  } catch (jwtError) {
    // JWT verification failed
  }

  // 4. If none of the above tokens are valid, mark as unauthenticated
  request.authType = 'none';
}

/**
 * Middleware to require any form of authentication
 * Use this when you need to ensure the request is authenticated but don't care about the type
 */
export function requireAnyWhitelistedAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  if (request.authType === 'none' || (request.authType === 'user' && !request.user?.isWhitelisted)) {
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
  const isDeveloperUser = request.authType === 'user' && !!request.user?.isDeveloper;

  if (!request.isAdminToken && !isDeveloperUser) {
    reply.code(401).send({ error: 'Unauthorized: Admin token or developer user required' });
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
  if (request.isAdminToken) {
    reply.code(403).send({ error: 'Forbidden: Admin token cannot be used for this operation' });
    return done(new Error('Forbidden'));
  }

  if (request.isMobileApp) {
    reply.code(403).send({ error: 'Forbidden: Mobile token cannot be used for this operation' });
    return done(new Error('Forbidden'));
  }

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
 * Middleware to require either admin or mobile authentication
 */
export function requireAdminOrMobileAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  const isDeveloperUser = request.authType === 'user' && !!request.user?.isDeveloper;

  if (!request.isAdminToken && !request.isMobileApp && !isDeveloperUser) {
    reply.code(401).send({ error: 'Unauthorized: Admin/developer or mobile token required' });
    return done(new Error('Unauthorized'));
  }
  
  done();
}

/**
 * Middleware to require admin, developer, or program-wide user (privilege >= 3) authentication
 */
export function requireAdminOrSuperAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  const isDeveloperUser = request.authType === 'user' && !!request.user?.isDeveloper;
  const isProgramWideUser = request.authType === 'user' && !!request.user && request.user.privilege >= 3;

  if (!request.isAdminToken && !isDeveloperUser && !isProgramWideUser) {
    reply.code(401).send({ error: 'Unauthorized: Admin, developer, or program-wide user authentication required' });
    return done(new Error('Unauthorized'));
  }

  done();
}

/**
 * Middleware to require admin, developer, program-wide user (privilege >= 3), or mobile authentication
 */
export function requireAdminOrMobileOrSuperAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  const isDeveloperUser = request.authType === 'user' && !!request.user?.isDeveloper;
  const isProgramWideUser = request.authType === 'user' && !!request.user && request.user.privilege >= 3;

  if (!request.isAdminToken && !request.isMobileApp && !isDeveloperUser && !isProgramWideUser) {
    reply.code(401).send({ error: 'Unauthorized: Admin, developer, program-wide user, or mobile token required' });
    return done(new Error('Unauthorized'));
  }

  done();
}

/**
 * Middleware to require admin privileges (for user JWT tokens with privilege >= 2)
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
  if (!request.user || request.user.privilege < 2) {
    reply.code(403).send({ error: 'Forbidden: Admin privileges required' });
    return done(new Error('Forbidden'));
  }

  done();
}

/**
 * Middleware to require annotation privileges (for user JWT tokens with privilege >= 4)
 */
export function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  // Admin token always has annotation privileges
  if (request.isAdminToken) {
    return done();
  }

  // For user tokens, check privilege level
  if (!request.user || request.user.privilege < 4) {
    reply.code(403).send({ error: 'Forbidden: Annotation privileges required' });
    return done(new Error('Forbidden'));
  }

  done();
}
