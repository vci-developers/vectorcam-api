import { FastifyRequest, FastifyReply } from 'fastify';
import { SiteUser, User, Site, Session, Specimen } from '../db/models';

interface PermissionOptions {
  resourceType: 'site' | 'session' | 'specimen';
  paramName?: string; // Parameter name to extract resource ID from (defaults to 'id')
}

/**
 * Middleware to check if user has permission to access a resource
 * Hierarchy: Site -> Session -> Specimen -> Images
 * 
 * Super admin (privilege = 2) can access all data
 * Admin (privilege = 1) can only access data under sites they are assigned to
 * Regular users (privilege = 0) cannot access admin endpoints
 */
export function checkPermission(options: PermissionOptions) {
  return async function permissionMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const user = request.user as any;
      if (!user || !user.userId) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const userId = user.userId;
      const { resourceType, paramName = 'id' } = options;

      // Get the resource ID from request params
      const resourceId = (request.params as any)[paramName];
      if (!resourceId) {
        return reply.code(400).send({ error: `Missing ${paramName} parameter` });
      }

      const resourceIdNum = parseInt(resourceId);
      if (isNaN(resourceIdNum)) {
        return reply.code(400).send({ error: `Invalid ${paramName} parameter` });
      }

      // Get user details
      const userRecord = await User.findByPk(userId);
      if (!userRecord) {
        return reply.code(401).send({ error: 'User not found' });
      }

      // Super admin can access everything
      if (userRecord.privilege === 2) {
        return; // Continue to next handler
      }

      // Regular users cannot access admin endpoints
      if (userRecord.privilege === 0) {
        return reply.code(403).send({ error: 'Insufficient privileges to access this resource' });
      }

      // Admin users (privilege = 1) need to have permissions checked
      if (userRecord.privilege === 1) {
        const hasPermission = await checkResourcePermission(
          userId,
          resourceType,
          resourceIdNum
        );

        if (!hasPermission) {
          return reply.code(403).send({ error: 'Insufficient permissions to access this resource' });
        }
      }

      // Permission granted, continue to next handler
      return;

    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  };
}

/**
 * Check if user has permission to access a specific resource
 */
async function checkResourcePermission(
  userId: number,
  resourceType: 'site' | 'session' | 'specimen',
  resourceId: number
): Promise<boolean> {
  try {
    let siteId: number;

    // Determine the site ID based on resource type
    switch (resourceType) {
      case 'site':
        siteId = resourceId;
        break;

      case 'session':
        const session = await Session.findByPk(resourceId);
        if (!session) return false;
        siteId = session.siteId;
        break;

      case 'specimen':
        const specimen = await Specimen.findByPk(resourceId, {
          include: [{
            model: Session,
            as: 'session',
            attributes: ['siteId']
          }]
        });
        if (!specimen || !(specimen as any).session) return false;
        siteId = (specimen as any).session.siteId;
        break;

      default:
        return false;
    }

    // Check if user has access to this site (role users have all permissions if they have access)
    const siteUser = await SiteUser.findOne({
      where: { userId, siteId }
    });

    return !!siteUser;

  } catch (error) {
    console.error('Error checking resource permission:', error);
    return false;
  }
}

/**
 * Convenience middleware functions for common use cases
 */

// Site permissions
export const checkSitePermission = (paramName = 'siteId') => 
  checkPermission({ resourceType: 'site', paramName });

// Session permissions
export const checkSessionPermission = (paramName = 'sessionId') => 
  checkPermission({ resourceType: 'session', paramName });

// Specimen permissions
export const checkSpecimenPermission = (paramName = 'specimenId') => 
  checkPermission({ resourceType: 'specimen', paramName });

/**
 * Helper function to check if user can access a site (for use in handlers)
 */
export async function canAccessSite(
  userId: number,
  siteId: number
): Promise<boolean> {
  try {
    // Get user details
    const user = await User.findByPk(userId);
    if (!user) return false;

    // Super admin can access everything
    if (user.privilege === 2) return true;

    // Regular users cannot access admin resources
    if (user.privilege === 0) return false;

    // Admin users need to check site permissions
    if (user.privilege === 1) {
      return checkResourcePermission(userId, 'site', siteId);
    }

    return false;
  } catch (error) {
    console.error('Error checking site access:', error);
    return false;
  }
}

/**
 * Helper function to get all sites a user can access
 */
export async function getUserAccessibleSites(
  userId: number
): Promise<number[]> {
  try {
    // Get user details
    const user = await User.findByPk(userId);
    if (!user) return [];

    // Super admin can access all sites
    if (user.privilege === 2) {
      const allSites = await Site.findAll({ attributes: ['id'] });
      return allSites.map(site => site.id);
    }

    // Regular users cannot access any sites
    if (user.privilege === 0) return [];

    // Admin users get sites they are assigned to (they have all permissions)
    if (user.privilege === 1) {
      const siteUsers = await SiteUser.findAll({
        where: { userId },
        attributes: ['siteId']
      });

      return siteUsers.map(siteUser => siteUser.siteId);
    }

    return [];
  } catch (error) {
    console.error('Error getting user accessible sites:', error);
    return [];
  }
}
