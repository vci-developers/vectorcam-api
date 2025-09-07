import { FastifyRequest, FastifyReply } from 'fastify';
import { Specimen, Session } from '../db/models';
import { HookHandlerDoneFunction } from 'fastify';

/**
 * Common function to check specimen access
 * This function looks up the specimen by ID, gets its session, and checks if the user has access to the session's site
 */
async function checkSpecimenAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
  requireWrite: boolean
): Promise<void> {
  const siteAccess = request.siteAccess;
  const permissionCheck = requireWrite ? siteAccess?.canWrite : siteAccess?.canRead;
  const permissionError = requireWrite 
    ? 'Forbidden: Insufficient permissions to modify specimen data'
    : 'Forbidden: Insufficient permissions to access specimen data';
  
  if (!permissionCheck) {
    reply.code(403).send({ error: permissionError });
    return done(new Error('Forbidden'));
  }

  // If userSites is empty, user has access to all sites (admin token, mobile token, or super admin)
  if (siteAccess!.userSites.length === 0) {
    return done();
  }

  // Extract specimen ID from request parameters
  const specimenId = getSpecimenIdFromRequest(request);
  
  if (!specimenId) {
    reply.code(400).send({ error: 'Bad Request: Specimen ID not found in request' });
    return done(new Error('Bad Request'));
  }

  try {
    // Look up the specimen to get its session, then the session's siteId
    const specimen = await Specimen.findByPk(specimenId, {
      include: [{
        model: Session,
        as: 'session',
        attributes: ['siteId']
      }],
      attributes: ['id']
    });

    if (!specimen) {
      reply.code(404).send({ error: 'Specimen not found' });
      return done(new Error('Not Found'));
    }

    const specimenData = specimen.get({ plain: true }) as any;
    const sessionSiteId = specimenData.session?.siteId;

    if (!sessionSiteId) {
      reply.code(500).send({ error: 'Internal server error: Could not determine specimen site' });
      return done(new Error('Internal Server Error'));
    }

    // Check if user has access to this specimen's session's site
    if (!siteAccess!.userSites.includes(sessionSiteId)) {
      reply.code(403).send({ error: 'Forbidden: No access to specimens from this site' });
      return done(new Error('Forbidden'));
    }

    done();
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Internal server error while checking specimen access' });
    return done(new Error('Internal Server Error'));
  }
}

/**
 * Middleware to check if user has read access to a specific specimen
 * This middleware looks up the specimen by ID, gets its session, and checks if the user has access to the session's site
 */
export async function requireSpecificSpecimenReadAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): Promise<void> {
  return checkSpecimenAccess(request, reply, done, false);
}

/**
 * Middleware to check if user has write access to a specific specimen
 * This middleware looks up the specimen by ID, gets its session, and checks if the user has write access to the session's site
 */
export async function requireSpecificSpecimenWriteAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): Promise<void> {
  return checkSpecimenAccess(request, reply, done, true);
}


/**
 * Helper function to extract specimen ID from request parameters
 * Supports specimen_id and specimenId parameter names
 */
function getSpecimenIdFromRequest(request: FastifyRequest): number | null {
  const params = request.params as any;
  
  // Check for common specimen ID parameter names
  const specimenId = params.specimen_id || params.specimenId || params.id;
  
  if (specimenId) {
    const parsed = parseInt(specimenId, 10);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

