import { FastifyRequest, FastifyReply } from 'fastify';
import { SiteUser, Site } from '../db/models';

// Extend FastifyRequest to include site access info
declare module 'fastify' {
  interface FastifyRequest {
    siteAccess?: {
      canRead: boolean;
      canWrite: boolean;
      canPush: boolean;
      userSites: number[];
    };
  }
}

/**
 * Site access control middleware that enforces the following rules:
 * 
 * New privilege map:
 * - 0: read/view for assigned site(s)
 * - 1: read/view for all sites
 * - 2: read/view/write/push for assigned site(s)
 * - 3: read/view/write/push for all sites + annotate
 *
 * - Whitelisted users: can view data for their sites only (treated like privilege 0 if no higher privilege)
 * - Admin token / mobile token: full access to all sites
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
      canPush: true,
      userSites: [] // Empty array means unrestricted access (admin/mobile tokens only)
    };
    return;
  }

  // Must be authenticated as a whitelisted user for site access
  if (request.authType !== 'user' || !request.user) {
    reply.code(401).send({ error: 'Unauthorized: Authentication required' });
    return;
  }

  if (!request.user.isWhitelisted) {
    reply.code(403).send({ error: 'Forbidden: Account not whitelisted. Contact an administrator.' });
    return;
  }

  const user = request.user;

  // programId must be set for whitelisted users — if null, it's an internal error
  if (user.programId == null) {
    request.log.error(`Internal error: whitelisted user ${user.id} has no programId`);
    reply.code(500).send({ error: 'Internal server error: user program not configured' });
    return;
  }

  // Get site access using the shared function (program-scoped)
  try {
    const siteAccess = await getUserSiteAccess(user.id, user.isWhitelisted, user.privilege, user.programId);
    request.siteAccess = siteAccess;

  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Internal server error while checking site access' });
    return;
  }
}

/**
 * Middleware to require read access to sites
 */
export async function requireSiteReadAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.siteAccess?.canRead) {
    reply.code(403).send({ error: 'Forbidden: Insufficient permissions to read site data' });
    return;
  }
  
}

/**
 * Middleware to require write access to sites
 */
export async function requireSiteWriteAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.siteAccess?.canWrite) {
    reply.code(403).send({ error: 'Forbidden: Insufficient permissions to modify site data' });
    return;
  }
  
}

/**
 * Middleware to check if user has access to a specific site
 * Use this for routes that have a site_id or siteId parameter
 */
export async function requireSpecificSiteReadAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const siteAccess = request.siteAccess;
  
  if (!siteAccess?.canRead) {
    reply.code(403).send({ error: 'Forbidden: Insufficient permissions to access site data' });
    return;
  }

  // If userSites is empty, user has unrestricted access (admin token or mobile token)
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
export async function requireSpecificSiteWriteAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const siteAccess = request.siteAccess;
  
  if (!siteAccess?.canWrite) {
    reply.code(403).send({ error: 'Forbidden: Insufficient permissions to modify site data' });
    return;
  }

  // If userSites is empty, user has unrestricted access (admin token or mobile token)
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

/**
 * Calculate user site access based on privilege level, site associations, and program scope
 * This function is shared between the middleware and permissions endpoint
 * 
 * All site access is now scoped to the user's assigned program.
 * For privilege 1 and 3, "all sites" means "all sites within the user's program".
 * No cross-program access is allowed.
 * 
 * @param userId - User ID
 * @param isWhitelisted - Whether the user is whitelisted
 * @param privilege - User privilege level
 * @param programId - User's assigned program ID (null for non-whitelisted users)
 * @returns Site access result with permissions and user sites
 */
export async function getUserSiteAccess(
  userId: number,
  isWhitelisted: boolean,
  privilege: number,
  programId: number | null
): Promise<{ canRead: boolean; canWrite: boolean; canPush: boolean; userSites: number[] }> {
  // Non-whitelisted users without a program have no access
  if (!programId) {
    return {
      canRead: false,
      canWrite: false,
      canPush: false,
      userSites: []
    };
  }

  // Super admin users (privilege >= 3) have access to all sites within their program
  if (privilege >= 3) {
    // Get all sites within the user's program
    const programSites = await Site.findAll({
      where: { programId },
      attributes: ['id']
    });
    const programSiteIds = programSites.map(site => site.id);

    return {
      canRead: true,
      canWrite: true,
      canPush: true,
      userSites: programSiteIds
    };
  }

  // For non-super users, get their site associations (used for privilege 0 and 2)
  const userSiteAssociations = await SiteUser.findAll({
    where: { userId },
    attributes: ['siteId']
  });

  const userSites = userSiteAssociations.map(association => association.siteId);

  // Privilege 2: read/write/push to assigned sites
  if (privilege === 2) {
    return {
      canRead: true,
      canWrite: true,
      canPush: true,
      userSites
    };
  }

  // Privilege 1: read-only access to all sites within the user's program
  if (privilege === 1) {
    // Get all sites within the user's program
    const programSites = await Site.findAll({
      where: { programId },
      attributes: ['id']
    });
    const programSiteIds = programSites.map(site => site.id);

    return {
      canRead: true,
      canWrite: false,
      canPush: false,
      userSites: programSiteIds,
    };
  }

  // Privilege 0 (or whitelisted): read-only for assigned sites
  if (isWhitelisted || privilege === 0) {
    return {
      canRead: userSites.length > 0,
      canWrite: false,
      canPush: false,
      userSites
    };
  }

  // Non-whitelisted users have no access
  return {
    canRead: false,
    canWrite: false,
    canPush: false,
    userSites: []
  };
}
