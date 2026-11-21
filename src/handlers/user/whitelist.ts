import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../db';
import { UserWhitelist, Site, SiteUser, User, Program } from '../../db/models';
import {
  getUserRoleAssignments,
  legacyPrivilegeAssignment,
  RoleAssignmentInput,
  RoleValidationError,
  setUserRoleAssignments,
} from '../../services/roles.service';
import { roleAssignmentInputSchema, roleAssignmentSchema } from '../role/common';

interface WhitelistBody {
  email: string;
  programId?: number;
  adminPrivilege?: number;
  roles?: RoleAssignmentInput[];
  districtAccess?: string;
  siteIds?: number[];
}

export const addToWhitelistSchema: any = {
  tags: ['Users'],
  summary: 'Add email to whitelist and grant privileges',
  description: 'Add an email to the whitelist and optionally grant admin privileges and site access (requires admin auth token)',
  headers: {
    type: 'object',
    properties: {
      authorization: { type: 'string', description: 'Bearer token' },
    },
    required: ['authorization'],
  },
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email' },
      programId: {
        type: 'number',
        description: 'Optional program ID override. If omitted, the user\'s stored programId is used.'
      },
      adminPrivilege: { 
        type: 'number',
        description: 'Deprecated, use roles. Assigns the matching built-in role: 0=Viewer on assigned sites, 1=Viewer for the program, 2=Editor on assigned sites, 3=Program Manager, 4=Program Admin',
        enum: [0, 1, 2, 3, 4]
      },
      roles: {
        type: 'array',
        items: roleAssignmentInputSchema,
        description: 'Role assignments that replace the user\'s current roles. Cannot be combined with adminPrivilege.'
      },
      districtAccess: {
        type: 'string',
        description: 'Optional district name to grant access to all sites in that district within the assigned program'
      },
      siteIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Optional array of site IDs to grant access to. These are merged with any sites resolved from districtAccess.'
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        whitelist: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            programId: { type: 'number' },
          },
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            name: { type: ['string', 'null'] },
            privilege: { type: 'number', description: 'Deprecated: legacy level derived from roles' },
            isDeveloper: { type: 'boolean' },
            programId: { type: 'number' },
            roles: { type: 'array', items: roleAssignmentSchema },
            sitesGranted: { type: 'number', description: 'Number of sites granted access to' },
          },
        },
      },
    },
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        whitelist: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            programId: { type: 'number' },
          },
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            name: { type: ['string', 'null'] },
            privilege: { type: 'number', description: 'Deprecated: legacy level derived from roles' },
            isDeveloper: { type: 'boolean' },
            programId: { type: 'number' },
            roles: { type: 'array', items: roleAssignmentSchema },
            sitesGranted: { type: 'number', description: 'Number of sites granted access to' },
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
    403: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export const getWhitelistSchema: any = {
  tags: ['Users'],
  summary: 'Get whitelist entries',
  description: 'Get all whitelist entries (requires admin auth token)',
  headers: {
    type: 'object',
    properties: {
      authorization: { type: 'string', description: 'Bearer token' },
    },
    required: ['authorization'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        whitelist: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              email: { type: 'string' },
              programId: { type: 'number' },
            },
          },
        },
      },
    },
    401: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    403: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export const removeFromWhitelistSchema: any = {
  tags: ['Users'],
  summary: 'Remove email from whitelist',
  description: 'Remove an email from the whitelist (requires admin auth token)',
  headers: {
    type: 'object',
    properties: {
      authorization: { type: 'string', description: 'Bearer token' },
    },
    required: ['authorization'],
  },
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' },
    },
    required: ['id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
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
    403: {
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
  },
};

/**
 * Add email to whitelist and grant privileges handler
 * Requires admin privileges
 */
export async function addToWhitelistHandler(request: FastifyRequest<{ Body: WhitelistBody }>, reply: FastifyReply): Promise<void> {
  try {
    const { email, programId: providedProgramId, adminPrivilege, roles, districtAccess, siteIds } = request.body;

    // Validate input
    if (!email) {
      return reply.code(400).send({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.code(400).send({ error: 'Invalid email format' });
    }

    // Validate admin privilege if provided
    if (adminPrivilege !== undefined && ![0, 1, 2, 3, 4].includes(adminPrivilege)) {
      return reply.code(400).send({ error: 'Invalid privilege. Must be 0, 1, 2, 3, or 4' });
    }
    if (adminPrivilege !== undefined && roles !== undefined) {
      return reply.code(400).send({ error: 'Provide either roles or adminPrivilege, not both' });
    }

    // Check if email is already whitelisted
    const existingEntry = await UserWhitelist.findOne({ where: { email } });
    
    // Find user by email
    const user = await User.findOne({ where: { email } });

    // Resolve effective program:
    // 1) explicit request override
    // 2) existing user program
    // 3) existing whitelist program
    const programId = providedProgramId ?? user?.programId ?? existingEntry?.programId ?? null;
    if (programId == null) {
      return reply.code(400).send({
        error: 'Program ID is required when user has no stored program assignment'
      });
    }

    // Validate that the resolved program exists
    const program = await Program.findByPk(programId);
    if (!program) {
      return reply.code(400).send({ error: `Program not found with ID: ${programId}` });
    }

    // Validate explicit site IDs against the selected program (applies whether or not user exists yet)
    const validatedSiteIds = siteIds ? Array.from(new Set(siteIds)) : [];
    if (validatedSiteIds.length > 0) {
      const validSites = await Site.findAll({
        where: { id: validatedSiteIds, programId },
        attributes: ['id']
      });

      const validSiteIdSet = new Set(validSites.map(site => site.id));
      const invalidSiteIds = validatedSiteIds.filter(id => !validSiteIdSet.has(id));

      if (invalidSiteIds.length > 0) {
        return reply.code(400).send({ error: `Site IDs not found in program ${programId}: ${invalidSiteIds.join(', ')}` });
      }
    }

    let sitesGranted = 0;
    let userInfo = null;
    let whitelistEntry = existingEntry;

    if (user) {
      // User exists, assign program and roles
      const transaction = await sequelize.transaction();
      try {
        await user.update({ programId }, { transaction });
        const assignments = roles
          ?? (adminPrivilege !== undefined ? [await legacyPrivilegeAssignment(adminPrivilege, transaction)] : undefined);
        if (assignments) {
          await setUserRoleAssignments(user, assignments, transaction);
        }
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        if (error instanceof RoleValidationError) {
          return reply.code(400).send({ error: error.message });
        }
        throw error;
      }

      // Collect site IDs to grant access to (merge districtAccess sites and explicit siteIds)
      const mergedSiteIdSet = new Set<number>();

      // Resolve sites from districtAccess
      if (districtAccess) {
        const sitesInDistrict = await Site.findAll({
          where: { district: districtAccess, programId },
          attributes: ['id']
        });

        if (sitesInDistrict.length === 0) {
          return reply.code(400).send({ error: `No sites found in district: ${districtAccess} within program: ${programId}` });
        }

        for (const site of sitesInDistrict) {
          mergedSiteIdSet.add(site.id);
        }
      }

      // Add explicit siteIds
      if (validatedSiteIds.length > 0) {
        for (const id of validatedSiteIds) {
          mergedSiteIdSet.add(id);
        }
      }

      // Grant access to all merged sites
      if (mergedSiteIdSet.size > 0) {
        const allSiteIds = Array.from(mergedSiteIdSet);

        // Get existing associations to calculate how many new ones were created
        const existingSiteUsers = await SiteUser.findAll({
          where: {
            userId: user.id,
            siteId: allSiteIds
          },
          attributes: ['siteId']
        });

        const existingSiteIdSet = new Set(existingSiteUsers.map(su => su.siteId));

        // Bulk create new associations, ignoring duplicates
        const siteUserRecords = allSiteIds.map(siteId => ({
          userId: user.id,
          siteId
        }));

        await SiteUser.bulkCreate(siteUserRecords, {
          ignoreDuplicates: true
        });

        sitesGranted = allSiteIds.length - existingSiteIdSet.size;
      }

      // Get updated user info
      await user.reload();
      userInfo = {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        privilege: user.privilege,
        isDeveloper: user.isDeveloper,
        programId: user.programId,
        roles: await getUserRoleAssignments(user.id),
        sitesGranted
      };
    }

    // Add to whitelist or update existing entry with programId
    if (!whitelistEntry) {
      whitelistEntry = await UserWhitelist.create({
        email,
        programId,
      });
    } else {
      // Update existing whitelist entry with new programId
      await whitelistEntry.update({ programId });
    }

    // Generate appropriate message based on what was requested and what was found
    let message: string;
    const wasAlreadyWhitelisted = existingEntry !== null;
    
    const hasSiteAccess = districtAccess || (siteIds && siteIds.length > 0);

    if (user) {
      const baseMessage = wasAlreadyWhitelisted 
        ? 'Email was already whitelisted.' 
        : 'Email added to whitelist successfully.';
      
      if (adminPrivilege !== undefined || roles !== undefined || hasSiteAccess) {
        message = `${baseMessage} User assigned to program ${programId}, roles updated and ${sitesGranted} sites granted access.`;
      } else {
        message = `${baseMessage} User assigned to program ${programId}.`;
      }
    } else {
      const baseMessage = wasAlreadyWhitelisted 
        ? 'Email was already whitelisted.' 
        : 'Email added to whitelist successfully.';
        
      const hasRoleRequest = adminPrivilege !== undefined || roles !== undefined;
      
      if (hasRoleRequest || hasSiteAccess) {
        const warnings = [];
        if (hasRoleRequest) warnings.push('roles');
        if (hasSiteAccess) warnings.push('site access');
        
        message = `${baseMessage} Program ${programId} recorded. WARNING: User not found - ${warnings.join(' and ')} could not be granted. User will need to register first to receive these privileges.`;
      } else {
        message = `${baseMessage} Program ${programId} recorded. User will receive access when they register.`;
      }
    }

    const statusCode = wasAlreadyWhitelisted ? 200 : 201;
    
    return reply.code(statusCode).send({
      message,
      whitelist: {
        id: whitelistEntry.id,
        email: whitelistEntry.email,
        programId: whitelistEntry.programId,
      },
      user: userInfo,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

/**
 * Get whitelist entries handler
 * Requires admin privileges
 */
export async function getWhitelistHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const whitelistEntries = await UserWhitelist.findAll({
      attributes: ['id', 'email', 'programId'],
      order: [['id', 'DESC']],
    });

    return reply.code(200).send({
      message: 'Whitelist entries retrieved successfully',
      whitelist: whitelistEntries,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

/**
 * Remove email from whitelist handler
 * Requires admin privileges
 */
export async function removeFromWhitelistHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
  try {
    const { id } = request.params;

    // Validate input
    if (!id || isNaN(parseInt(id))) {
      return reply.code(400).send({ error: 'Valid whitelist entry ID is required' });
    }

    // Find and delete whitelist entry
    const whitelistEntry = await UserWhitelist.findByPk(parseInt(id));
    if (!whitelistEntry) {
      return reply.code(404).send({ error: 'Whitelist entry not found' });
    }

    await whitelistEntry.destroy();

    return reply.code(200).send({
      message: 'Email removed from whitelist successfully',
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
