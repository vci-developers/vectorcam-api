import { FastifyRequest, FastifyReply } from 'fastify';
import { getUserSiteAccess } from '../../middleware/siteAccess.middleware';
import { Site } from '../../db/models';
import { formatSiteResponse } from '../site/common';

interface PermissionsQuery {
  siteId?: string;
}

export const getPermissionsSchema: any = {
  tags: ['Users'],
  summary: 'Get current user permissions',
  description: 'Get structured permissions for the authenticated user with optional site filtering',
  headers: {
    type: 'object',
    properties: {
      authorization: { type: 'string', description: 'Bearer token' },
    },
    required: ['authorization'],
  },
  querystring: {
    type: 'object',
    properties: {
      siteId: { type: 'string', description: 'Optional site ID to get permissions for that specific site' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        permissions: {
          type: 'object',
          properties: {
            sites: {
              type: 'object',
              properties: {
                viewSiteMetadata: { type: 'boolean' },
                writeSiteMetadata: { type: 'boolean' },
                pushSiteMetadata: { type: 'boolean' },
                canAccessSites: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      siteId: { type: 'number' },
                      programId: { type: 'number' },
                      district: { type: 'string', nullable: true },
                      subCounty: { type: 'string', nullable: true },
                      parish: { type: 'string', nullable: true },
                      villageName: { type: 'string', nullable: true },
                      houseNumber: { type: 'string' },
                      isActive: { type: 'boolean' },
                      healthCenter: { type: 'string', nullable: true }
                    },
                    // Allow dynamic location hierarchy keys
                    additionalProperties: { type: ['string', 'number', 'boolean', 'null'] }
                  },
                  description: 'Array of site objects user has access to. Empty array means access to all sites.'
                },
              },
            },
            annotations: {
              type: 'object',
              properties: {
                viewAndWriteAnnotationTasks: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    401: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

/**
 * Get current user permissions handler
 * Maps authenticated user permissions into structured format based on privilege level and site associations
 * 
 * Permission mapping logic:
 * New privilege map:
 * - 0: READ/VIEW assigned site(s)
 * - 1: READ/VIEW all sites
 * - 2: READ/VIEW + WRITE + PUSH assigned site(s)
 * - 3: READ/VIEW + WRITE + PUSH all sites + ANNOTATE
 * - Regular User: No access
 */
export async function getPermissionsHandler(
  request: FastifyRequest<{ Querystring: PermissionsQuery }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { siteId } = request.query;

    // Get user ID from authenticated user in request
    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const user = request.user;
    // Validate siteId parameter if provided
    let parsedSiteId: number | undefined;
    if (siteId) {
      parsedSiteId = parseInt(siteId);
      if (isNaN(parsedSiteId)) {
        return reply.code(400).send({ error: 'Valid site ID is required' });
      }
    }

    // Get site access using the shared function from middleware
    const siteAccess = await getUserSiteAccess(user.id, user.isWhitelisted, user.privilege);

    // Structure the permissions response
    let hasAccessToQueriedSite = true;

    // If siteId query parameter is provided, filter permissions for that specific site
    if (parsedSiteId !== undefined) {
      if (user.privilege >= 3 || siteAccess.userSites.length === 0) {
        // Super admin or users with read-all permissions
        hasAccessToQueriedSite = true;
      } else {
        // Check if the site is in user's site list
        hasAccessToQueriedSite = siteAccess.userSites.includes(parsedSiteId);
      }
    }

    // Determine site permissions
    let sitePermissions = {
      viewSiteMetadata: false,
      writeSiteMetadata: false,
      pushSiteMetadata: false,
      canAccessSites: [] as any[],
    };

    // Determine annotation permissions
    let annotationPermissions = {
      viewAndWriteAnnotationTasks: false,
    };

    if (user.privilege >= 3) {
      // Super Admin: Full permissions including annotate and push
      sitePermissions.viewSiteMetadata = true;
      sitePermissions.writeSiteMetadata = true;
      sitePermissions.pushSiteMetadata = true;
      annotationPermissions.viewAndWriteAnnotationTasks = true;
      sitePermissions.canAccessSites = await Site.findAll();
    } else if (user.privilege === 2) {
      // Per-site writer/pusher
      sitePermissions.viewSiteMetadata = hasAccessToQueriedSite && siteAccess.canRead;
      sitePermissions.writeSiteMetadata = hasAccessToQueriedSite && siteAccess.canWrite;
      sitePermissions.pushSiteMetadata = hasAccessToQueriedSite && siteAccess.canPush;
      annotationPermissions.viewAndWriteAnnotationTasks = false;
    } else if (user.privilege === 1) {
      // Read-only all sites
      sitePermissions.viewSiteMetadata = true;
      sitePermissions.writeSiteMetadata = false;
      sitePermissions.pushSiteMetadata = false;
      annotationPermissions.viewAndWriteAnnotationTasks = false;
      // Leave canAccessSites empty to indicate all sites readable
    } else if (siteAccess.canRead) {
      // Privilege 0 / whitelisted read-only per site
      sitePermissions.viewSiteMetadata = hasAccessToQueriedSite;
      sitePermissions.writeSiteMetadata = false;
      sitePermissions.pushSiteMetadata = false;
      annotationPermissions.viewAndWriteAnnotationTasks = false;
    }

    // Fetch site objects for non-super admin users
    if (user.privilege < 3 && siteAccess.userSites.length > 0) {
      sitePermissions.canAccessSites = await Site.findAll({
        where: {
          id: siteAccess.userSites,
        },
      });
    }

    sitePermissions.canAccessSites = await Promise.all(
      sitePermissions.canAccessSites.map(site => formatSiteResponse(site))
    );

    const permissions = {
      sites: sitePermissions,
      annotations: annotationPermissions,
    };

    return reply.code(200).send({
      message: 'User permissions retrieved successfully',
      permissions,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
