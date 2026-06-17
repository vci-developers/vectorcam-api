import { FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../../db/models';
import { isSmtpConfigured } from '../../services/email.service';
import {
  createEmailVerificationToken,
  sendVerificationEmail,
  verifyEmailVerificationToken,
} from '../../services/emailVerification.service';

interface VerifyEmailBody {
  token: string;
}

export const sendEmailVerificationSchema: any = {
  tags: ['Users'],
  summary: 'Send email verification',
  description: 'Send a verification email to the currently authenticated user (user JWT only)',
  headers: {
    type: 'object',
    properties: {
      authorization: { type: 'string', description: 'Bearer user JWT' },
    },
    required: ['authorization'],
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
    500: {
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
  },
};

export const verifyEmailSchema: any = {
  tags: ['Users'],
  summary: 'Verify email address',
  description: 'Verify the currently authenticated user email using a verification token (user JWT only)',
  headers: {
    type: 'object',
    properties: {
      authorization: { type: 'string', description: 'Bearer user JWT' },
    },
    required: ['authorization'],
  },
  body: {
    type: 'object',
    required: ['token'],
    properties: {
      token: {
        type: 'string',
        description: 'Verification token from the email link',
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
            emailVerified: { type: 'boolean' },
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

export async function sendEmailVerificationHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    if (!isSmtpConfigured()) {
      return reply.code(503).send({ error: 'Email service is not configured' });
    }

    const userId = request.user!.id;
    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'emailVerified'],
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return reply.code(400).send({ error: 'Email is already verified' });
    }

    const token = createEmailVerificationToken(user.id, user.email);
    await sendVerificationEmail(user.email, token);

    return reply.code(200).send({
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to send verification email' });
  }
}

export async function verifyEmailHandler(
  request: FastifyRequest<{ Body: VerifyEmailBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { token } = request.body;
    const userId = request.user!.id;

    if (!token?.trim()) {
      return reply.code(400).send({ error: 'Verification token is required' });
    }

    let decoded;
    try {
      decoded = verifyEmailVerificationToken(token);
    } catch {
      return reply.code(400).send({ error: 'Invalid or expired verification token' });
    }

    if (decoded.userId !== userId) {
      return reply.code(400).send({ error: 'Verification token does not match the authenticated user' });
    }

    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'emailVerified'],
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    if (user.email !== decoded.email) {
      return reply.code(400).send({ error: 'Verification token does not match the current email address' });
    }

    if (user.emailVerified) {
      return reply.code(200).send({
        message: 'Email is already verified',
        user: {
          id: user.id,
          email: user.email,
          emailVerified: true,
        },
      });
    }

    await user.update({ emailVerified: true });

    return reply.code(200).send({
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
