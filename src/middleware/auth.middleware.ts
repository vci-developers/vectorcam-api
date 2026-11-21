import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { HookHandlerDoneFunction } from 'fastify';
import { UserWhitelist, User } from '../db/models';
import { recordUserActivity } from '../services/userActivity.service';
import { AccessContext } from '../services/accessContext';
import { loadUserAccess } from '../services/access.service';
import { MOBILE_APP_PERMISSIONS } from '../services/permissions';

interface JwtPayload {
  userId: number;
  email: string;
}

// Extend FastifyRequest to include unified auth info
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number;
      email: string;
      isWhitelisted: boolean;
      isDeveloper: boolean;
      programId: number | null;
    };
    access: AccessContext;
    isAdminToken?: boolean;
    isMobileApp?: boolean;
    authType?: 'admin' | 'user' | 'mobile' | 'none';
  }
}

/**
 * Unified authentication middleware that checks for all possible auth types
 * Priority order: admin token -> mobile token -> user JWT
 * Fills in user info and the request's access context (permissions and site scope)
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  request.access = AccessContext.none();
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
    request.access = AccessContext.unrestricted();
    return;
  }

  // 2. Then check for mobile token
  if (token === config.mobileAuthToken) {
    request.isMobileApp = true;
    request.authType = 'mobile';
    request.access = AccessContext.unrestricted(MOBILE_APP_PERMISSIONS);
    return;
  }

  // 3. Then check for user JWT token
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    request.user = {
      id: decoded.userId,
      email: decoded.email,
      isWhitelisted: false,
      isDeveloper: false,
      programId: null,
    };
    request.authType = 'user';

    try {
      // Fetch current user data from database so access changes apply immediately
      const [user, userWhitelist] = await Promise.all([
        User.findByPk(decoded.userId, { attributes: ['isDeveloper', 'programId'] }),
        UserWhitelist.findOne({ where: { email: decoded.email } })
      ]);

      if (user) {
        request.user.isDeveloper = user.isDeveloper;
        request.user.programId = user.programId;
      }
      request.user.isWhitelisted = !!userWhitelist;

      if (request.user.isDeveloper) {
        request.access = AccessContext.unrestricted();
      } else if (request.user.isWhitelisted) {
        request.access = await loadUserAccess(request.user.id, request.user.programId);
      }

      recordUserActivity(decoded.userId);
    } catch (dbError) {
      // Without fresh user data the request keeps no permissions
      request.log.error(dbError);
    }
    return;
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
