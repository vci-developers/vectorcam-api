import { FastifyRequest, FastifyReply } from 'fastify';
import { Site } from '../../db/models';
import { formatSiteResponse, siteCoordinatesResponseSchema } from '../site/common';
import { getUserRoleAssignments } from '../../services/roles.service';
import { Permission } from '../../services/permissions';

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
        programId: { type: 'number', description: 'The program the user is assigned to' },
        permissions: {
          type: 'object',
          properties: {
            devMode: { type: 'boolean', description: 'Whether developer mode features should be enabled in the client' },
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
                      name: { type: 'string', nullable: true },
                      locationTypeId: { type: 'number' },
                      parentId: { type: 'number' },
                      district: { type: 'string', nullable: true },
                      subCounty: { type: 'string', nullable: true },
                      parish: { type: 'string', nullable: true },
                      villageName: { type: 'string', nullable: true },
                      houseNumber: { type: 'string' },
                      isActive: { type: 'boolean' },
                      hasData: { type: 'boolean' },
                      healthCenter: { type: 'string', nullable: true },
                      ...siteCoordinatesResponseSchema,
                      locationHierarchy: {
                        type: 'object',
                        additionalProperties: { type: 'string' }
                      }
                    }
                  },
                  description: 'Sites the user can read within their assigned program, including child sites of assigned sites.'
                },
              },
            },
            annotations: {
              type: 'object',
              properties: {
                viewAndWriteAnnotationTasks: { type: 'boolean' },
              },
            },
            grants: {
              type: 'array',
              description: 'Every permission the user holds and the scope it applies to (program, assigned_sites, or all)',
              items: {
                type: 'object',
                properties: {
                  permission: { type: 'string' },
                  scope: { type: 'string' },
                },
              },
            },
            roles: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  roleId: { type: 'number' },
                  key: { type: 'string' },
                  name: { type: 'string' },
                  programId: { type: ['number', 'null'] },
                  isSystem: { type: 'boolean' },
                  scope: { type: 'string' },
                },
              },
            },
            assignedSiteIds: {
              type: 'array',
              description: 'Sites the user is directly assigned to',
              items: { type: 'number' },
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
 * Get current user permissions handler.
 * The site booleans are kept for existing clients; `grants` lists the full permission set.
 * With `siteId`, each site boolean also requires the permission to cover that site.
 */
export async function getPermissionsHandler(
  request: FastifyRequest<{ Querystring: PermissionsQuery }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { siteId } = request.query;

    if (!request.user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const user = request.user;

    // programId must be set for whitelisted users — if null, it's an internal error
    if (user.programId == null) {
      request.log.error(`Internal error: whitelisted user ${user.id} has no programId`);
      return reply.code(500).send({ error: 'Internal server error: user program not configured' });
    }

    let parsedSiteId: number | undefined;
    if (siteId) {
      parsedSiteId = parseInt(siteId);
      if (isNaN(parsedSiteId)) {
        return reply.code(400).send({ error: 'Valid site ID is required' });
      }
    }

    const access = request.access;
    const programId = user.programId;
    const programSiteIds = async (): Promise<number[]> => {
      const sites = await Site.findAll({ where: { programId }, attributes: ['id'] });
      return sites.map((site) => site.id);
    };

    // Unrestricted users (developers) are reported against their own program's sites
    const sitesFor = async (permission: Permission): Promise<number[]> =>
      (await access.siteIdsFor(permission)) ?? programSiteIds();

    const holdsForQueriedSite = async (permission: Permission): Promise<boolean> => {
      if (!access.has(permission)) return false;
      if (parsedSiteId === undefined) return true;
      return (await sitesFor(permission)).includes(parsedSiteId);
    };

    const [viewSiteMetadata, writeSiteMetadata, pushSiteMetadata, readableSiteIds, roles] = await Promise.all([
      holdsForQueriedSite('site:read'),
      holdsForQueriedSite('site:write'),
      holdsForQueriedSite('dhis2:push'),
      sitesFor('site:read'),
      getUserRoleAssignments(user.id),
    ]);

    const readableSites = readableSiteIds.length > 0
      ? await Site.findAll({ where: { id: readableSiteIds } })
      : [];

    const permissions = {
      devMode: !!user.isDeveloper,
      sites: {
        viewSiteMetadata,
        writeSiteMetadata,
        pushSiteMetadata,
        canAccessSites: await Promise.all(readableSites.map((site) => formatSiteResponse(site))),
      },
      annotations: {
        viewAndWriteAnnotationTasks: access.has('annotation:annotate'),
      },
      grants: access.grants(),
      roles,
      assignedSiteIds: [...access.assignedSiteIds],
    };

    return reply.code(200).send({
      message: 'User permissions retrieved successfully',
      programId: user.programId,
      permissions,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
