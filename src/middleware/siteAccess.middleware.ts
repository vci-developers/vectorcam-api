import { FastifyRequest, FastifyReply } from 'fastify';
import { SiteUser } from '../db/models';

// Extend FastifyRequest to include site access info
declare module 'fastify' {
  interface FastifyRequest {
    siteAccess?: {
      canRead: boolean;
      canWrite: boolean;
      userSites: number[];
    };
  }
}

/**
 * Site access control middleware that enforces the following rules:
 * 
 * - Whitelisted users: can view data for their sites only
 * - Admin users (privilege >= 1): can view/edit data for their sites
 * - Super admin users (privilege >= 2): can view/edit data for any sites
 * - Admin token: can view/edit any data
 * - Mobile token: can view/edit any data
 */
export async function siteAccessMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Admin token and mobile token have full access
  if (request.isAdminToken || request.isMobileApp) {
    request.siteAccess = {
      canRead: true,
      canWrite: true,
      userSites: [] // Empty array means access to all sites
    };
    return;
  }

  // Must be authenticated as a user for site access
  if (request.authType !== 'user' || !request.user) {
    request.siteAccess = {
      canRead: false,
      canWrite: false,
      userSites: []
    };
    return;
  }

  const user = request.user;

  // Super admin users (privilege >= 2) have full access to all sites
  if (user.privilege >= 2) {
    request.siteAccess = {
      canRead: true,
      canWrite: true,
      userSites: [] // Empty array means access to all sites
    };
    return;
  }

  // For regular users and admin users (privilege >= 1), get their site associations
  try {
    const userSiteAssociations = await SiteUser.findAll({
      where: { userId: user.id },
      attributes: ['siteId']
    });

    const userSites = userSiteAssociations.map(association => 
      (association as any).siteId
    );

    // Admin users (privilege >= 1) can read and write to their sites
    if (user.privilege >= 1) {
      request.siteAccess = {
        canRead: true,
        canWrite: true,
        userSites
      };
      return;
    }

    // Whitelisted regular users can only read their sites
    if (user.isWhitelisted) {
      request.siteAccess = {
        canRead: true,
        canWrite: false,
        userSites
      };
      return;
    }

    // Non-whitelisted users have no access
    request.siteAccess = {
      canRead: false,
      canWrite: false,
      userSites: []
    };

  } catch (error) {
    request.log.error(error);
    request.siteAccess = {
      canRead: false,
      canWrite: false,
      userSites: []
    };
  }
}

/**
 * Middleware to require read access to sites
 */
export function requireSiteReadAccess(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (!request.siteAccess?.canRead) {
    reply.code(403).send({ error: 'Forbidden: Insufficient permissions to read site data' });
    return;
  }
  
}

/**
 * Middleware to require write access to sites
 */
export function requireSiteWriteAccess(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (!request.siteAccess?.canWrite) {
    reply.code(403).send({ error: 'Forbidden: Insufficient permissions to modify site data' });
    return;
  }
  
}

/**
 * Middleware to check if user has access to a specific site
 * Use this for routes that have a site_id or siteId parameter
 */
export function requireSpecificSiteReadAccess(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const siteAccess = request.siteAccess;
  
  if (!siteAccess?.canRead) {
    reply.code(403).send({ error: 'Forbidden: Insufficient permissions to access site data' });
    return;
  }

  // If userSites is empty, user has access to all sites (admin token, mobile token, or super admin)
  if (siteAccess.userSites.length === 0) {
    return;
  }

  // Extract site ID from request parameters
  const siteId = getSiteIdFromRequest(request);
  
  if (!siteId) {
    reply.code(400).send({ error: 'Bad Request: Site ID not found in request' });
    return;
  }

  // Check if user has access to this specific site
  if (!siteAccess.userSites.includes(siteId)) {
    reply.code(403).send({ error: 'Forbidden: No access to this specific site' });
    return;
  }

}

/**
 * Middleware to check if user has write access to a specific site
 * Use this for routes that modify site data and have a site_id or siteId parameter
 */
export function requireSpecificSiteWriteAccess(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const siteAccess = request.siteAccess;
  
  if (!siteAccess?.canWrite) {
    reply.code(403).send({ error: 'Forbidden: Insufficient permissions to modify site data' });
    return;
  }

  // If userSites is empty, user has access to all sites (admin token, mobile token, or super admin)
  if (siteAccess.userSites.length === 0) {
    return;
  }

  // Extract site ID from request parameters
  const siteId = getSiteIdFromRequest(request);
  
  if (!siteId) {
    reply.code(400).send({ error: 'Bad Request: Site ID not found in request' });
    return;
  }

  // Check if user has access to this specific site
  if (!siteAccess.userSites.includes(siteId)) {
    reply.code(403).send({ error: 'Forbidden: No access to this specific site' });
    return;
  }

}

/**
 * Helper function to extract site ID from request parameters
 * Supports both site_id and siteId parameter names
 */
function getSiteIdFromRequest(request: FastifyRequest): number | null {
  const params = request.params as any;
  
  // Check for common site ID parameter names
  const siteId = params.site_id || params.siteId || params.id;
  
  if (siteId) {
    const parsed = parseInt(siteId, 10);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}
