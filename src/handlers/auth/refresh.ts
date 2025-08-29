import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { User } from '../../db/models';
import { config } from '../../config/environment';

interface RefreshBody {
  refreshToken: string;
}

export const refreshTokenSchema: any = {
  tags: ['Authentication'],
  summary: 'Refresh access token',
  description: 'Get a new access token using a valid refresh token',
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        accessToken: { type: 'string' },
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

interface JwtRefreshPayload {
  userId: number;
  email: string;
  privilege: number;
}

/**
 * Token refresh handler
 * Validates refresh token and returns new access token
 */
export async function refreshTokenHandler(request: FastifyRequest<{ Body: RefreshBody }>, reply: FastifyReply): Promise<void> {
  try {
    const { refreshToken } = request.body;

    // Validate input
    if (!refreshToken) {
      return reply.code(400).send({ error: 'Refresh token is required' });
    }

    // Verify refresh token
    let decoded: JwtRefreshPayload;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtRefreshPayload;
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }

    // Verify user still exists and is active
    const user = await User.findOne({ 
      where: { 
        id: decoded.userId, 
        email: decoded.email, 
        isActive: true 
      } 
    });

    if (!user) {
      return reply.code(401).send({ error: 'User not found or inactive' });
    }

    // Generate new access token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      privilege: user.privilege,
    };

    const accessTokenExpiry = config.jwt.expiresIn;
    
    const accessToken = jwt.sign(tokenPayload, config.jwt.secret, { expiresIn: accessTokenExpiry } as any);

    return reply.code(200).send({
      message: 'Token refreshed successfully',
      accessToken,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
