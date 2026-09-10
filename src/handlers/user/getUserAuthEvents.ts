import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { User, UserAuthEvent } from '../../db/models';
import { UserAuthEventType } from '../../db/models/UserAuthEvent';
import { queryUserLoginActivity, userLoginActivitySchema } from './userLoginActivity';

const authEventResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    userId: { type: 'number' },
    eventType: { type: 'string', enum: Object.values(UserAuthEventType) },
    ipAddress: { type: ['string', 'null'] },
    userAgent: { type: ['string', 'null'] },
    metadata: { type: ['object', 'null'], additionalProperties: true },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
};

export const getUserAuthEventsSchema: any = {
  tags: ['Users'],
  summary: 'List user auth events',
  description: 'List login/logout/signup/token refresh audit events (requires admin token or developer user)',
  querystring: {
    type: 'object',
    properties: {
      userId: { type: 'number', description: 'Filter by user ID' },
      programId: { type: 'number', description: 'Filter by program ID' },
      eventType: {
        type: 'string',
        enum: Object.values(UserAuthEventType),
        description: 'Filter by event type',
      },
      startDate: { type: 'string', description: 'Inclusive start date (YYYY-MM-DD)' },
      endDate: { type: 'string', description: 'Inclusive end date (YYYY-MM-DD)' },
      limit: { type: 'number', minimum: 1, maximum: 500, default: 50 },
      offset: { type: 'number', minimum: 0, default: 0 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        distinctUserCount: { type: 'number' },
        users: userLoginActivitySchema,
        events: {
          type: 'array',
          items: authEventResponseSchema,
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' },
        hasMore: { type: 'boolean' },
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

interface QueryParams {
  userId?: number;
  programId?: number;
  eventType?: UserAuthEventType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

function isValidDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getDateRange(startDate?: string, endDate?: string): { [Op.gte]?: Date; [Op.lte]?: Date } | undefined {
  if (!startDate && !endDate) {
    return undefined;
  }

  return {
    ...(startDate ? { [Op.gte]: new Date(`${startDate}T00:00:00.000Z`) } : {}),
    ...(endDate ? { [Op.lte]: new Date(`${endDate}T23:59:59.999Z`) } : {}),
  };
}

function getActivityDateBounds(startDate: string, endDate: string): { startAt: Date; endAt: Date } {
  return {
    startAt: new Date(`${startDate}T00:00:00.000Z`),
    endAt: new Date(`${endDate}T23:59:59.999Z`),
  };
}

function formatAuthEvent(event: UserAuthEvent) {
  return {
    id: event.id,
    userId: event.userId,
    eventType: event.eventType,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function buildEmptyResponse(limit: number, offset: number) {
  return {
    message: 'User auth events retrieved successfully',
    distinctUserCount: 0,
    users: [],
    events: [],
    total: 0,
    limit,
    offset,
    hasMore: false,
  };
}

export async function getUserAuthEventsHandler(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const {
      userId,
      programId,
      eventType,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = request.query;

    if (startDate && !isValidDateOnly(startDate)) {
      return reply.code(400).send({ error: 'startDate must be YYYY-MM-DD' });
    }

    if (endDate && !isValidDateOnly(endDate)) {
      return reply.code(400).send({ error: 'endDate must be YYYY-MM-DD' });
    }

    if (eventType && !Object.values(UserAuthEventType).includes(eventType)) {
      return reply.code(400).send({ error: 'Invalid eventType' });
    }

    const where: Record<string, unknown> = {};

    if (programId !== undefined) {
      const userWhere: Record<string, unknown> = { programId };
      if (userId !== undefined) {
        userWhere.id = userId;
      }

      const matchingUserIds = (
        await User.findAll({
          attributes: ['id'],
          where: userWhere,
          raw: true,
        })
      ).map((user) => user.id);

      if (matchingUserIds.length === 0) {
        return reply.code(200).send(buildEmptyResponse(limit, offset));
      }

      where.userId = { [Op.in]: matchingUserIds };
    } else if (userId !== undefined) {
      where.userId = userId;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    const createdAtRange = getDateRange(startDate, endDate);
    if (createdAtRange) {
      where.createdAt = createdAtRange;
    }

    const includeLoginActivity = startDate !== undefined && endDate !== undefined;
    const loginActivityPromise = includeLoginActivity
      ? queryUserLoginActivity({
          ...getActivityDateBounds(startDate, endDate),
          programId,
          userId,
        })
      : Promise.resolve([]);

    const [{ rows, count }, users] = await Promise.all([
      UserAuthEvent.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      }),
      loginActivityPromise,
    ]);

    return reply.code(200).send({
      message: 'User auth events retrieved successfully',
      distinctUserCount: users.length,
      users,
      events: rows.map(formatAuthEvent),
      total: count,
      limit,
      offset,
      hasMore: offset + rows.length < count,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
