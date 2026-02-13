import { FastifyRequest, FastifyReply } from 'fastify';
import { UserWhitelist, Site, SiteUser, User, Program } from '../../db/models';

interface WhitelistBody {
  email: string;
  programId: number;
  adminPrivilege?: number;
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
    required: ['email', 'programId'],
    properties: {
      email: { type: 'string', format: 'email' },
      programId: {
        type: 'number',
        description: 'Program ID to assign the user to. All site access will be scoped to this program.'
      },
      adminPrivilege: { 
        type: 'number',
        description: 'Optional privilege: 0=view one site, 1=view all in program, 2=write/push one site, 3=write/push all in program + annotate',
        enum: [0, 1, 2, 3]
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
            privilege: { type: 'number' },
            programId: { type: 'number' },
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
            privilege: { type: 'number' },
            programId: { type: 'number' },
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
    const { email, programId, adminPrivilege, districtAccess, siteIds } = request.body;

    // Validate input
    if (!email) {
      return reply.code(400).send({ error: 'Email is required' });
    }

    if (!programId) {
      return reply.code(400).send({ error: 'Program ID is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.code(400).send({ error: 'Invalid email format' });
    }

    // Validate admin privilege if provided
    if (adminPrivilege !== undefined && ![0, 1, 2, 3].includes(adminPrivilege)) {
      return reply.code(400).send({ error: 'Invalid privilege. Must be 0, 1, 2, or 3' });
    }

    // Validate that the program exists
    const program = await Program.findByPk(programId);
    if (!program) {
      return reply.code(400).send({ error: `Program not found with ID: ${programId}` });
    }

    // Check if email is already whitelisted
    const existingEntry = await UserWhitelist.findOne({ where: { email } });
    
    // Find user by email
    const user = await User.findOne({ where: { email } });
    let sitesGranted = 0;
    let userInfo = null;
    let whitelistEntry = existingEntry;

    if (user) {
      // User exists, assign program and grant privileges/site access
      const updateData: any = { programId };
      if (adminPrivilege !== undefined) {
        updateData.privilege = adminPrivilege;
      }
      await user.update(updateData);

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
      if (siteIds && siteIds.length > 0) {
        // Validate that the provided site IDs exist and belong to the program
        const validSites = await Site.findAll({
          where: { id: siteIds, programId },
          attributes: ['id']
        });

        const validSiteIdSet = new Set(validSites.map(s => s.id));
        const invalidSiteIds = siteIds.filter(id => !validSiteIdSet.has(id));

        if (invalidSiteIds.length > 0) {
          return reply.code(400).send({ error: `Site IDs not found in program ${programId}: ${invalidSiteIds.join(', ')}` });
        }

        for (const id of siteIds) {
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
        privilege: user.privilege,
        programId: user.programId,
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
      
      if (adminPrivilege !== undefined || hasSiteAccess) {
        message = `${baseMessage} User assigned to program ${programId}, privileges updated and ${sitesGranted} sites granted access.`;
      } else {
        message = `${baseMessage} User assigned to program ${programId}.`;
      }
    } else {
      const baseMessage = wasAlreadyWhitelisted 
        ? 'Email was already whitelisted.' 
        : 'Email added to whitelist successfully.';
        
      const hasPrivilegeRequest = adminPrivilege !== undefined;
      
      if (hasPrivilegeRequest || hasSiteAccess) {
        const warnings = [];
        if (hasPrivilegeRequest) warnings.push('admin privileges');
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
