import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { ReviewActionLog } from '../../db/models';

interface GetReviewActionLogsQuery {
  siteId?: number;
  month?: number;
  year?: number;
  action?: string;
  userId?: number;
  hasChanges?: boolean;
  page?: number;
  size?: number;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Get review action logs',
  querystring: {
    type: 'object',
    properties: {
      siteId: { type: 'number' },
      month: { type: 'number', minimum: 1, maximum: 12 },
      year: { type: 'number' },
      action: { type: 'string' },
      userId: { type: 'number' },
      hasChanges: { type: 'boolean' },
      page: { type: 'number', minimum: 1, default: 1 },
      size: { type: 'number', minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        logs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              siteId: { type: 'number' },
              year: { type: 'number' },
              month: { type: 'number' },
              action: { type: 'string' },
              userId: { type: ['number', 'null'] },
              hasChanges: { type: 'boolean' },
              changes: { type: ['object', 'null'], additionalProperties: true },
              fields: { type: ['object', 'null'], additionalProperties: true },
              metadata: { type: ['object', 'null'], additionalProperties: true },
              createdAt: { type: 'number' },
              updatedAt: { type: 'number' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            size: { type: 'number' },
            totalPages: { type: 'number' },
            totalItems: { type: 'number' },
          },
        },
      },
    },
    403: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export async function getReviewActionLogs(
  request: FastifyRequest<{ Querystring: GetReviewActionLogsQuery }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const {
      siteId,
      month,
      year,
      action,
      userId,
      hasChanges,
      page = 1,
      size = 20,
    } = request.query;

    const whereClause: Record<string, unknown> = {};
    const siteAccess = request.siteAccess;

    if (siteAccess && siteAccess.userSites.length > 0) {
      if (siteId !== undefined) {
        if (!siteAccess.userSites.includes(siteId)) {
          return reply.code(403).send({ error: 'Forbidden: You do not have access to logs for this site' });
        }
        whereClause.siteId = siteId;
      } else {
        whereClause.siteId = { [Op.in]: siteAccess.userSites };
      }
    } else if (siteId !== undefined) {
      whereClause.siteId = siteId;
    }

    if (month !== undefined) {
      whereClause.month = month;
    }
    if (year !== undefined) {
      whereClause.year = year;
    }
    if (action) {
      whereClause.action = action;
    }
    if (userId !== undefined) {
      whereClause.userId = userId;
    }
    if (hasChanges !== undefined) {
      whereClause.hasChanges = hasChanges;
    }

    const offset = (page - 1) * size;
    const totalItems = await ReviewActionLog.count({ where: whereClause });
    const logs = await ReviewActionLog.findAll({
      where: whereClause,
      limit: size,
      offset,
      order: [['createdAt', 'DESC']],
    });

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      siteId: log.siteId,
      year: log.year,
      month: log.month,
      action: log.action,
      userId: log.userId,
      hasChanges: log.hasChanges,
      changes: log.changes,
      fields: log.fields,
      metadata: log.metadata,
      createdAt: log.createdAt.getTime(),
      updatedAt: log.updatedAt.getTime(),
    }));

    return reply.send({
      logs: formattedLogs,
      pagination: {
        page,
        size,
        totalPages: Math.ceil(totalItems / size),
        totalItems,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to retrieve review action logs' });
  }
}
