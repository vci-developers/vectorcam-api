import { FastifyRequest, FastifyReply } from 'fastify';
import { User, UserWhitelist } from '../../db/models';

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
            name: { type: ['string', 'null'] },
            privilege: { type: 'number' },
            programId: { type: 'number', nullable: true },
            isActive: { type: 'boolean' },
            isWhitelisted: { type: 'boolean' },
            emailVerified: { type: 'boolean' },
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
  querystring: {
    type: 'object',
    properties: {
      programId: { type: 'number', description: 'Filter by program ID' },
    },
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
              name: { type: ['string', 'null'] },
              privilege: { type: 'number' },
              isDeveloper: { type: 'boolean' },
              programId: { type: 'number', nullable: true },
              isActive: { type: 'boolean' },
              emailVerified: { type: 'boolean' },
              lastActiveAt: { type: ['string', 'null'] },
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
      attributes: ['id', 'email', 'name', 'privilege', 'isDeveloper', 'programId', 'isActive', 'emailVerified', 'createdAt', 'updatedAt'],
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const userWhiteList = await UserWhitelist.findOne({
      where: {
        email: user.email,
      },
    });

    return reply.code(200).send({
      message: 'Profile retrieved successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        privilege: user.privilege,
        programId: user.programId,
        isActive: user.isActive,
        isWhitelisted: !!userWhiteList,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

interface GetUsersQueryParams {
  programId?: number;
}

function formatUserListItem(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    privilege: user.privilege,
    isDeveloper: user.isDeveloper,
    programId: user.programId,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Get all users handler
 * Requires admin privileges
 */
export async function getUsersHandler(
  request: FastifyRequest<{ Querystring: GetUsersQueryParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { programId } = request.query;

    const where: Record<string, unknown> = {};
    if (programId !== undefined) {
      where.programId = programId;
    }

    const users = await User.findAll({
      attributes: [
        'id',
        'email',
        'name',
        'privilege',
        'isDeveloper',
        'programId',
        'isActive',
        'emailVerified',
        'lastActiveAt',
        'createdAt',
        'updatedAt',
      ],
      where,
      order: [['createdAt', 'DESC']],
    });

    return reply.code(200).send({
      message: 'Users retrieved successfully',
      users: users.map(formatUserListItem),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
