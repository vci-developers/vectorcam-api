import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { UserAuthEvent } from '../../db/models';
import { UserAuthEventType } from '../../db/models/UserAuthEvent';

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

export async function getUserAuthEventsHandler(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const {
      userId,
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

    if (userId !== undefined) {
      where.userId = userId;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    const createdAtRange = getDateRange(startDate, endDate);
    if (createdAtRange) {
      where.createdAt = createdAtRange;
    }

    const { rows, count } = await UserAuthEvent.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return reply.code(200).send({
      message: 'User auth events retrieved successfully',
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
