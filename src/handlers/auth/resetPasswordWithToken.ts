import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { User } from '../../db/models';
import { validatePassword } from '../../utils/validation';
import { verifyPasswordResetToken } from '../../services/passwordReset.service';

interface ResetPasswordBody {
  token: string;
  newPassword: string;
}

export const resetPasswordWithTokenSchema: any = {
  tags: ['Authentication'],
  summary: 'Reset password with token',
  description: 'Reset password using a token from the password reset email (verified users only)',
  body: {
    type: 'object',
    required: ['token', 'newPassword'],
    properties: {
      token: {
        type: 'string',
        description: 'Password reset token from the email link',
      },
      newPassword: {
        type: 'string',
        minLength: 8,
        maxLength: 128,
        description: 'New password must be 8-128 characters long',
      },
    },
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
        details: {
          type: 'array',
          items: { type: 'string' },
        },
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

export async function resetPasswordWithTokenHandler(
  request: FastifyRequest<{ Body: ResetPasswordBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { token, newPassword } = request.body;

    if (!token?.trim()) {
      return reply.code(400).send({ error: 'Password reset token is required' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return reply.code(400).send({
        error: 'Password validation failed',
        details: passwordValidation.errors,
      });
    }

    let decoded;
    try {
      decoded = verifyPasswordResetToken(token);
    } catch {
      return reply.code(400).send({ error: 'Invalid or expired password reset token' });
    }

    const user = await User.findOne({
      where: {
        id: decoded.userId,
        email: decoded.email,
        isActive: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found or email is not verified' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await user.update({ passwordHash });

    return reply.code(200).send({ message: 'Password reset successfully' });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
