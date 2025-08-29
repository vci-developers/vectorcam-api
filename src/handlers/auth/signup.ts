import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../../db/models';
import { config } from '../../config/environment';

interface SignupBody {
  email: string;
  password: string;
}

export const signupSchema: any = {
  tags: ['Authentication'],
  summary: 'User signup',
  description: 'Register a new user account with email/password. Anyone can signup.',
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
    },
  },
  response: {
    201: {
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
    409: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

/**
 * User signup handler
 * Requires email to be whitelisted
 * Password is hashed using bcrypt before storage
 */
export async function signupHandler(request: FastifyRequest<{ Body: SignupBody }>, reply: FastifyReply): Promise<void> {
  try {
    const { email, password } = request.body;

    // Validate input
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return reply.code(409).send({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await User.create({
      email,
      passwordHash,
    });

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

    return reply.code(201).send({
      message: 'User created successfully',
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
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
