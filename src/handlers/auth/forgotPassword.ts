import { FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../../db/models';
import { validateEmail } from '../../utils/validation';
import { isSmtpConfigured } from '../../services/email.service';
import {
  createPasswordResetToken,
  sendPasswordResetEmail,
} from '../../services/passwordReset.service';

interface ForgotPasswordBody {
  email: string;
}

const GENERIC_SUCCESS_MESSAGE =
  'If an account with a verified email exists for this address, a password reset link has been sent.';

export const forgotPasswordSchema: any = {
  tags: ['Authentication'],
  summary: 'Request password reset',
  description: 'Send a password reset email to users with a verified email address',
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email' },
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
      },
    },
    503: {
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

export async function forgotPasswordHandler(
  request: FastifyRequest<{ Body: ForgotPasswordBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { email } = request.body;

    if (!email?.trim()) {
      return reply.code(400).send({ error: 'Email is required' });
    }

    if (!validateEmail(email)) {
      return reply.code(400).send({ error: 'Invalid email format' });
    }

    if (!isSmtpConfigured()) {
      return reply.code(503).send({ error: 'Email service is not configured' });
    }

    const user = await User.findOne({
      where: { email: email.trim(), isActive: true, emailVerified: true },
      attributes: ['id', 'email'],
    });

    if (user) {
      const token = createPasswordResetToken(user.id, user.email);
      await sendPasswordResetEmail(user.email, token);
    }

    return reply.code(200).send({ message: GENERIC_SUCCESS_MESSAGE });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to process password reset request' });
  }
}
