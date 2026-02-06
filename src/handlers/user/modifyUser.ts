import { FastifyRequest, FastifyReply } from 'fastify';
import { User, Program } from '../../db/models';

interface ModifyUserBody {
  privilege: number;
  programId?: number;
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
        description: 'Privilege level: 0=view selected sites, 1=view all in program, 2=write/push selected sites, 3=write/push all in program + annotate',
        enum: [0, 1, 2, 3]
      },
      programId: {
        type: 'number',
        description: 'Optional program ID to assign the user to. All site access will be scoped to this program.'
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
            programId: { type: 'number', nullable: true },
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
    const { privilege, programId } = request.body;

    // Validate input
    if (!id || isNaN(parseInt(id))) {
      return reply.code(400).send({ error: 'Valid user ID is required' });
    }

    if (![0, 1, 2, 3].includes(privilege)) {
      return reply.code(400).send({ error: 'Invalid privilege level. Must be 0, 1, 2, or 3' });
    }

    // Validate programId if provided
    if (programId !== undefined) {
      const program = await Program.findByPk(programId);
      if (!program) {
        return reply.code(400).send({ error: `Program not found with ID: ${programId}` });
      }
    }

    // Find user by ID
    const user = await User.findByPk(parseInt(id));
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Update user privilege and optionally programId
    const updateData: any = { privilege };
    if (programId !== undefined) {
      updateData.programId = programId;
    }
    await user.update(updateData);

    return reply.code(200).send({
      message: 'User updated successfully',
      user: {
        id: user.id,
        email: user.email,
        privilege: user.privilege,
        programId: user.programId,
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
