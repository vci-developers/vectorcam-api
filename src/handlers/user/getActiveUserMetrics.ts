import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { ActiveUserMetric } from '../../db/models';

const metricResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    snapshotDate: { type: 'string' },
    programId: { type: ['number', 'null'] },
    a1Count: { type: 'number' },
    a7Count: { type: 'number' },
    a30Count: { type: 'number' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
};

export const getActiveUserMetricsSchema: any = {
  tags: ['Users'],
  summary: 'List active user metrics',
  description: 'List rolling A1/A7/A30 snapshots (requires admin token or developer user)',
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string', description: 'Inclusive start date (YYYY-MM-DD)' },
      endDate: { type: 'string', description: 'Inclusive end date (YYYY-MM-DD)' },
      programId: { type: 'number', description: 'Filter by program ID' },
      globalOnly: { type: 'boolean', default: false, description: 'Only global rows (programId is null)' },
      limit: { type: 'number', minimum: 1, maximum: 365, default: 30 },
      offset: { type: 'number', minimum: 0, default: 0 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        metrics: {
          type: 'array',
          items: metricResponseSchema,
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
  startDate?: string;
  endDate?: string;
  programId?: number;
  globalOnly?: boolean;
  limit?: number;
  offset?: number;
}

function isValidDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatMetric(metric: ActiveUserMetric) {
  return {
    id: metric.id,
    snapshotDate: String(metric.snapshotDate),
    programId: metric.programId,
    a1Count: metric.a1Count,
    a7Count: metric.a7Count,
    a30Count: metric.a30Count,
    createdAt: metric.createdAt.toISOString(),
    updatedAt: metric.updatedAt.toISOString(),
  };
}

export async function getActiveUserMetricsHandler(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const {
      startDate,
      endDate,
      programId,
      globalOnly = false,
      limit = 30,
      offset = 0,
    } = request.query;

    if (startDate && !isValidDateOnly(startDate)) {
      return reply.code(400).send({ error: 'startDate must be YYYY-MM-DD' });
    }

    if (endDate && !isValidDateOnly(endDate)) {
      return reply.code(400).send({ error: 'endDate must be YYYY-MM-DD' });
    }

    if (globalOnly && programId !== undefined) {
      return reply.code(400).send({ error: 'globalOnly cannot be used with programId' });
    }

    const where: Record<string, unknown> = {};

    if (startDate || endDate) {
      where.snapshotDate = {
        ...(startDate ? { [Op.gte]: startDate } : {}),
        ...(endDate ? { [Op.lte]: endDate } : {}),
      };
    }

    if (globalOnly) {
      where.programId = null;
    } else if (programId !== undefined) {
      where.programId = programId;
    }

    const { rows, count } = await ActiveUserMetric.findAndCountAll({
      where,
      order: [['snapshotDate', 'DESC'], ['programId', 'ASC']],
      limit,
      offset,
    });

    return reply.code(200).send({
      message: 'Active user metrics retrieved successfully',
      metrics: rows.map(formatMetric),
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
