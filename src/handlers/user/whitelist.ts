import { FastifyRequest, FastifyReply } from 'fastify';
import { UserWhitelist, Site, SiteUser, User } from '../../db/models';

interface WhitelistBody {
  email: string;
  adminPrivilege?: number;
  districtAccess?: string;
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
      adminPrivilege: { 
        type: 'number',
        description: 'Optional admin privilege level: 0 (no privilege), 1 (admin), 2 (superadmin)',
        enum: [0, 1, 2]
      },
      districtAccess: {
        type: 'string',
        description: 'Optional district name to grant access to all sites in that district'
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
          },
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            privilege: { type: 'number' },
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
          },
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            privilege: { type: 'number' },
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
    const { email, adminPrivilege, districtAccess } = request.body;

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
    if (adminPrivilege !== undefined && ![0, 1, 2].includes(adminPrivilege)) {
      return reply.code(400).send({ error: 'Invalid admin privilege. Must be 0 (no privilege), 1 (admin), or 2 (superadmin)' });
    }

    // Check if email is already whitelisted
    const existingEntry = await UserWhitelist.findOne({ where: { email } });
    
    // Find user by email
    const user = await User.findOne({ where: { email } });
    let sitesGranted = 0;
    let userInfo = null;
    let whitelistEntry = existingEntry;

    if (user) {
      // User exists, grant privileges and site access
      
      // Update admin privilege if specified
      if (adminPrivilege !== undefined) {
        await user.update({ privilege: adminPrivilege });
      }

      // Grant site access based on district if specified
      if (districtAccess) {
        // Find all sites in the specified district
        const sitesInDistrict = await Site.findAll({
          where: { district: districtAccess },
          attributes: ['id']
        });

        if (sitesInDistrict.length === 0) {
          return reply.code(400).send({ error: `No sites found in district: ${districtAccess}` });
        }

        // Create SiteUser associations for all sites in the district
        // First, get existing associations to calculate how many new ones were created
        const existingSiteUsers = await SiteUser.findAll({
          where: {
            userId: user.id,
            siteId: sitesInDistrict.map(site => site.id)
          },
          attributes: ['siteId']
        });
        
        const existingSiteIds = new Set(existingSiteUsers.map(su => su.siteId));
        
        // Bulk create new associations, ignoring duplicates
        const siteUserRecords = sitesInDistrict.map(site => ({
          userId: user.id,
          siteId: site.id
        }));
        
        await SiteUser.bulkCreate(siteUserRecords, { 
          ignoreDuplicates: true 
        });
        
        sitesGranted = sitesInDistrict.length - existingSiteIds.size;
      }

      // Get updated user info
      await user.reload();
      userInfo = {
        id: user.id,
        email: user.email,
        privilege: user.privilege,
        sitesGranted
      };
    }

    // Add to whitelist if not already there
    if (!whitelistEntry) {
      whitelistEntry = await UserWhitelist.create({
        email,
      });
    }

    // Generate appropriate message based on what was requested and what was found
    let message: string;
    const wasAlreadyWhitelisted = existingEntry !== null;
    
    if (user) {
      const baseMessage = wasAlreadyWhitelisted 
        ? 'Email was already whitelisted.' 
        : 'Email added to whitelist successfully.';
      
      if (adminPrivilege !== undefined || districtAccess) {
        message = `${baseMessage} User privileges updated and ${sitesGranted} sites granted access.`;
      } else {
        message = `${baseMessage} No additional privileges requested.`;
      }
    } else {
      const baseMessage = wasAlreadyWhitelisted 
        ? 'Email was already whitelisted.' 
        : 'Email added to whitelist successfully.';
        
      const hasPrivilegeRequest = adminPrivilege !== undefined;
      const hasDistrictRequest = districtAccess !== undefined;
      
      if (hasPrivilegeRequest || hasDistrictRequest) {
        const warnings = [];
        if (hasPrivilegeRequest) warnings.push('admin privileges');
        if (hasDistrictRequest) warnings.push('district access');
        
        message = `${baseMessage} WARNING: User not found - ${warnings.join(' and ')} could not be granted. User will need to register first to receive these privileges.`;
      } else {
        message = `${baseMessage} User will receive access when they register.`;
      }
    }

    const statusCode = wasAlreadyWhitelisted ? 200 : 201;
    
    return reply.code(statusCode).send({
      message,
      whitelist: {
        id: whitelistEntry.id,
        email: whitelistEntry.email,
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
      attributes: ['id', 'email'],
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
