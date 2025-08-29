import { FastifyRequest, FastifyReply } from 'fastify';
import { UserWhitelist } from '../../db/models';

interface WhitelistBody {
  email: string;
}

export const addToWhitelistSchema: any = {
  tags: ['Users'],
  summary: 'Add email to whitelist',
  description: 'Add an email to the whitelist (requires admin auth token)',
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
    },
  },
  response: {
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
    409: {
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
 * Add email to whitelist handler
 * Requires admin privileges
 */
export async function addToWhitelistHandler(request: FastifyRequest<{ Body: WhitelistBody }>, reply: FastifyReply): Promise<void> {
  try {
    const { email } = request.body;

    // Validate input
    if (!email) {
      reply.code(400).send({ error: 'Email is required' });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      reply.code(400).send({ error: 'Invalid email format' });
      return;
    }

    // Check if email is already whitelisted
    const existingEntry = await UserWhitelist.findOne({ where: { email } });
    if (existingEntry) {
      reply.code(409).send({ error: 'Email is already whitelisted' });
      return;
    }

    // Add to whitelist
    const whitelistEntry = await UserWhitelist.create({
      email,
    });

    reply.code(201).send({
      message: 'Email added to whitelist successfully',
      whitelist: {
        id: whitelistEntry.id,
        email: whitelistEntry.email,
      },
    });
  } catch (error) {
    request.log.error('Error in add to whitelist handler:', error);
    reply.code(500).send({ error: 'Internal server error' });
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

    reply.code(200).send({
      message: 'Whitelist entries retrieved successfully',
      whitelist: whitelistEntries,
    });
  } catch (error) {
    request.log.error('Error in get whitelist handler:', error);
    reply.code(500).send({ error: 'Internal server error' });
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
      reply.code(400).send({ error: 'Valid whitelist entry ID is required' });
      return;
    }

    // Find and delete whitelist entry
    const whitelistEntry = await UserWhitelist.findByPk(parseInt(id));
    if (!whitelistEntry) {
      reply.code(404).send({ error: 'Whitelist entry not found' });
      return;
    }

    await whitelistEntry.destroy();

    reply.code(200).send({
      message: 'Email removed from whitelist successfully',
    });
  } catch (error) {
    request.log.error('Error in remove from whitelist handler:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
}
