import { FastifyRequest, FastifyReply } from 'fastify';
import { Session } from '../db/models';

/**
 * Middleware to check if user has access to a specific session
 * This middleware looks up the session by ID and checks if the user has access to the session's site
 */
export async function requireSpecificSessionReadAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const siteAccess = request.siteAccess;
  
  if (!siteAccess?.canRead) {
    reply.code(403).send({ error: 'Forbidden: Insufficient permissions to access session data' });
    return;
  }

  // If userSites is empty, user has access to all sites (admin token, mobile token, or super admin)
  if (siteAccess.userSites.length === 0) {
    return;
  }

  // Extract session ID from request parameters
  const sessionId = getSessionIdFromRequest(request);
  
  if (!sessionId) {
    reply.code(400).send({ error: 'Bad Request: Session ID not found in request' });
    return;
  }

  try {
    // Look up the session to get its siteId (handle both numeric ID and frontendId)
    const session = await findSessionByIdOrFrontendId(sessionId);

    if (!session) {
      reply.code(404).send({ error: 'Session not found' });
      return;
    }

    const sessionData = session.get({ plain: true }) as any;
    const sessionSiteId = sessionData.siteId;

    // Check if user has access to this session's site
    if (!siteAccess.userSites.includes(sessionSiteId)) {
      reply.code(403).send({ error: 'Forbidden: No access to sessions from this site' });
      return;
    }

  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Internal server error while checking session access' });
    return;
  }
}

/**
 * Middleware to check if user has write access to a specific session
 * This middleware looks up the session by ID and checks if the user has write access to the session's site
 */
export async function requireSpecificSessionWriteAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const siteAccess = request.siteAccess;
  
  if (!siteAccess?.canWrite) {
    reply.code(403).send({ error: 'Forbidden: Insufficient permissions to modify session data' });
    return;
  }

  // If userSites is empty, user has access to all sites (admin token, mobile token, or super admin)
  if (siteAccess.userSites.length === 0) {
    return;
  }

  // Extract session ID from request parameters
  const sessionId = getSessionIdFromRequest(request);
  
  if (!sessionId) {
    reply.code(400).send({ error: 'Bad Request: Session ID not found in request' });
    return;
  }

  try {
    // Look up the session to get its siteId (handle both numeric ID and frontendId)
    const session = await findSessionByIdOrFrontendId(sessionId);

    if (!session) {
      reply.code(404).send({ error: 'Session not found' });
      return;
    }

    const sessionData = session.get({ plain: true }) as any;
    const sessionSiteId = sessionData.siteId;

    // Check if user has access to this session's site
    if (!siteAccess.userSites.includes(sessionSiteId)) {
      reply.code(403).send({ error: 'Forbidden: No access to sessions from this site' });
      return;
    }

  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Internal server error while checking session access' });
    return;
  }
}

/**
 * Helper function to extract session ID from request parameters
 * Supports session_id and sessionId parameter names, and also handles frontendId lookup
 */
function getSessionIdFromRequest(request: FastifyRequest): string | number | null {
  const params = request.params as any;
  
  // Check for common session ID parameter names
  const sessionId = params.session_id || params.sessionId || params.id;
  
  if (sessionId) {
    // Try to parse as number first, but also allow string (for frontendId)
    const parsed = parseInt(sessionId, 10);
    return isNaN(parsed) ? sessionId : parsed;
  }
  
  return null;
}

/**
 * Enhanced session lookup that handles both numeric IDs and frontendIds
 * This is useful because sessions can be accessed by either ID or frontendId
 */
export async function findSessionByIdOrFrontendId(sessionId: string | number): Promise<any> {
  // If it's a number, look up by primary key first
  if (typeof sessionId === 'number') {
    return await Session.findByPk(sessionId);
  }
  
  // If it's a string, try to parse as number first
  const numericId = parseInt(sessionId as string, 10);
  if (!isNaN(numericId)) {
    const session = await Session.findByPk(numericId);
    if (session) return session;
  }
  
  // If not found by ID, try frontendId
  return await Session.findOne({
    where: { frontendId: sessionId }
  });
}

/**
 * Middleware that allows access to sessions from a specific site
 * Use this for routes like /sessions/sites/:site_id
 */
export function requireSiteSessionAccess(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const siteAccess = request.siteAccess;
  
  if (!siteAccess?.canRead) {
    reply.code(403).send({ error: 'Forbidden: Insufficient permissions to access session data' });
    return;
  }

  // If userSites is empty, user has access to all sites (admin token, mobile token, or super admin)
  if (siteAccess.userSites.length === 0) {
    return;
  }

  // Extract site ID from request parameters
  const params = request.params as any;
  const siteId = params.site_id || params.siteId;
  
  if (!siteId) {
    reply.code(400).send({ error: 'Bad Request: Site ID not found in request' });
    return;
  }

  const numericSiteId = parseInt(siteId, 10);
  if (isNaN(numericSiteId)) {
    reply.code(400).send({ error: 'Bad Request: Invalid site ID format' });
    return;
  }

  // Check if user has access to this specific site
  if (!siteAccess.userSites.includes(numericSiteId)) {
    reply.code(403).send({ error: 'Forbidden: No access to sessions from this site' });
    return;
  }

}
