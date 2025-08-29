import { FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../../db/models';

export const getProfileSchema: any = {
  tags: ['Users'],
  summary: 'Get current user profile',
  description: 'Get the current authenticated user profile information',
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
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            privilege: { type: 'number' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
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
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export const getUsersSchema: any = {
  tags: ['Users'],
  summary: 'Get all users',
  description: 'Get list of all users (requires admin token)',
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
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              email: { type: 'string' },
              privilege: { type: 'number' },
              isActive: { type: 'boolean' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
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

/**
 * Get current user profile handler
 * Returns user information based on JWT token
 */
export async function getProfileHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const userId = request.user!.id; // User is guaranteed to exist due to auth middleware

    // Fetch user details
    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'privilege', 'isActive', 'createdAt', 'updatedAt'],
    });

    if (!user) {
      reply.code(404).send({ error: 'User not found' });
      return;
    }

    reply.code(200).send({
      message: 'Profile retrieved successfully',
      user: {
        id: user.id,
        email: user.email,
        privilege: user.privilege,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    request.log.error('Error in get profile handler:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
}

/**
 * Get all users handler
 * Requires admin privileges
 */
export async function getUsersHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'privilege', 'isActive', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
    });

    reply.code(200).send({
      message: 'Users retrieved successfully',
      users,
    });
  } catch (error) {
    request.log.error('Error in get users handler:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
}
