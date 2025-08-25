import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../../db/models';
import { config } from '../../config/environment';

interface LoginBody {
  email: string;
  password: string;
}

export const loginSchema: any = {
  tags: ['Authentication'],
  summary: 'User login',
  description: 'Authenticate user with email/password and return JWT tokens',
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
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
          },
        },
        tokens: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
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
  },
};

/**
 * User login handler
 * Authenticates user with email/password and returns JWT tokens
 */
export async function loginHandler(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply): Promise<void> {
  try {
    const { email, password } = request.body;

    // Validate input
    if (!email || !password) {
      reply.code(400).send({ error: 'Email and password are required' });
      return;
    }

    // Find user by email
    const user = await User.findOne({ where: { email, isActive: true } });
    if (!user) {
      reply.code(401).send({ error: 'Invalid email or password' });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      reply.code(401).send({ error: 'Invalid email or password' });
      return;
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      privilege: user.privilege,
    };

    const accessTokenExpiry = config.jwt.expiresIn;
    const refreshTokenExpiry = config.jwt.refreshExpiresIn;
    
    const accessToken = jwt.sign(tokenPayload, config.jwt.secret, { expiresIn: accessTokenExpiry } as any);
    const refreshToken = jwt.sign(tokenPayload, config.jwt.refreshSecret, { expiresIn: refreshTokenExpiry } as any);

    reply.code(200).send({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        privilege: user.privilege,
        isActive: user.isActive,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    request.log.error('Error in login handler:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
}
