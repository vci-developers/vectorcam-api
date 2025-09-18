import { FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../../db/models';

interface ModifyUserBody {
  privilege: number;
}

interface ModifyUserParams {
  id: string;
}

export const modifyUserSchema: any = {
  tags: ['Users'],
  summary: 'Modify user privileges',
  description: 'Modify user privilege level (admin auth token required)',
  headers: {
    type: 'object',
    properties: {
      authorization: { type: 'string', description: 'Bearer admin-auth-token' },
    },
    required: ['authorization'],
  },
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'User ID' },
    },
    required: ['id'],
  },
  body: {
    type: 'object',
    required: ['privilege'],
    properties: {
      privilege: { 
        type: 'number',
        description: 'Privilege level: 0 (no privilege), 1 (admin), 2 (superadmin)',
        enum: [0, 1, 2]
      },
    },
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
            updatedAt: { type: 'string' },
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
  },
};

/**
 * Modify user privileges handler
 * Requires admin auth token
 */
export async function modifyUserHandler(
  request: FastifyRequest<{ Body: ModifyUserBody; Params: ModifyUserParams }>, 
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params;
    const { privilege } = request.body;

    // Validate input
    if (!id || isNaN(parseInt(id))) {
      return reply.code(400).send({ error: 'Valid user ID is required' });
    }

    if (![0, 1, 2].includes(privilege)) {
      return reply.code(400).send({ error: 'Invalid privilege level. Must be 0 (no privilege), 1 (admin), or 2 (superadmin)' });
    }

    // Find user by ID
    const user = await User.findByPk(parseInt(id));
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Update user privilege
    await user.update({ privilege });

    return reply.code(200).send({
      message: 'User privilege updated successfully',
      user: {
        id: user.id,
        email: user.email,
        privilege: user.privilege,
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
