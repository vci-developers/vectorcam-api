import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { User } from '../../db/models';
import { validatePassword } from '../../utils/validation';

interface ResetPasswordBody {
  newPassword: string;
}

interface ResetPasswordParams {
  id: string;
}

export const resetPasswordSchema: any = {
  tags: ['Users'],
  summary: 'Reset user password',
  description: 'Reset a user\'s password (admin auth token required)',
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
    required: ['newPassword'],
    properties: {
      newPassword: { 
        type: 'string',
        minLength: 8,
        maxLength: 128,
        description: 'New password must be 8-128 characters long'
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
            updatedAt: { type: 'string' },
          },
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        details: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Detailed validation error messages'
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
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

/**
 * Reset user password handler
 * Requires admin auth token
 */
export async function resetPasswordHandler(
  request: FastifyRequest<{ Body: ResetPasswordBody; Params: ResetPasswordParams }>, 
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params;
    const { newPassword } = request.body;

    // Validate input
    if (!id || isNaN(parseInt(id))) {
      return reply.code(400).send({ error: 'Valid user ID is required' });
    }

    // Validate password format
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return reply.code(400).send({ 
        error: 'Password validation failed', 
        details: passwordValidation.errors 
      });
    }

    // Find user by ID
    const user = await User.findByPk(parseInt(id));
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Hash the new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    await user.update({ passwordHash });

    return reply.code(200).send({
      message: 'Password reset successfully',
      user: {
        id: user.id,
        email: user.email,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
