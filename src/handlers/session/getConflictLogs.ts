import { FastifyRequest, FastifyReply } from 'fastify';
import { SessionConflictResolution } from '../../db/models';
import sequelize from '../../db/index';
import { Op } from 'sequelize';

interface GetConflictLogsQuery {
  siteId?: string;
  month?: string;
  year?: string;
  sessionId?: string;
  page?: string;
  size?: string;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Get session conflict resolution logs',
  querystring: {
    type: 'object',
    properties: {
      siteId: { type: 'number' },
      month: { type: 'number', minimum: 1, maximum: 12 },
      year: { type: 'number' },
      sessionId: { type: 'number' },
      page: { type: 'number', minimum: 1, default: 1 },
      size: { type: 'number', minimum: 1, maximum: 100, default: 10 },
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
              resolvedByUserId: { type: ['number', 'null'] },
              resolvedAt: { type: 'number' },
              sessionIds: {
                type: 'array',
                items: { type: 'number' },
              },
              siteId: { type: 'number' },
              month: { type: 'number' },
              year: { type: 'number' },
              beforeData: { 
                type: 'object',
                additionalProperties: true
              },
              afterData: { 
                type: 'object',
                additionalProperties: true
              },
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
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export async function getConflictLogs(
  request: FastifyRequest<{ Querystring: GetConflictLogsQuery }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { siteId, month, year, sessionId, page = '1', size = '10' } = request.query;

    // Build where clause
    const where: any = {};

    // Check site access and filter by user's sites if necessary
    const siteAccess = request.siteAccess;
    if (siteAccess && siteAccess.userSites.length > 0) {
      // User has limited site access - only show logs for their sites
      if (siteId) {
        const requestedSiteId = parseInt(siteId, 10);
        // Verify user has access to the requested site
        if (!siteAccess.userSites.includes(requestedSiteId)) {
          return reply.code(403).send({
            error: 'Forbidden: You do not have access to logs for this site',
          });
        }
        where.siteId = requestedSiteId;
      } else {
        // No specific site requested - filter to only user's sites
        where.siteId = {
          [Op.in]: siteAccess.userSites,
        };
      }
    } else {
      // User has access to all sites (admin/super admin)
      if (siteId) {
        where.siteId = parseInt(siteId, 10);
      }
    }

    if (month) {
      where.month = parseInt(month, 10);
    }

    if (year) {
      where.year = parseInt(year, 10);
    }

    if (sessionId) {
      const sessionIdNum = parseInt(sessionId, 10);
      // For MySQL, use JSON_CONTAINS to find logs that include this session ID
      // Note: This will be handled in the query directly since MySQL JSON handling differs
      where.sessionIds = sequelize.literal(`JSON_CONTAINS(session_ids, '${sessionIdNum}')`);
    }

    // Calculate pagination
    const pageNum = parseInt(page, 10);
    const sizeNum = parseInt(size, 10);
    const offset = (pageNum - 1) * sizeNum;

    // Get total count
    const totalItems = await SessionConflictResolution.count({ where });

    // Get logs with explicit attribute selection
    const logs = await SessionConflictResolution.findAll({
      where,
      attributes: [
        'id',
        'resolvedByUserId',
        'resolvedAt',
        'sessionIds',
        'siteId',
        'month',
        'year',
        'beforeData',
        'afterData'
      ],
      limit: sizeNum,
      offset,
      order: [['resolvedAt', 'DESC']],
    });

    // Format response
    const formattedLogs = logs.map(log => {
      // Use get() to retrieve the raw values from Sequelize model
      const plainLog = log.get({ plain: true });
      
      return {
        id: plainLog.id,
        resolvedByUserId: plainLog.resolvedByUserId,
        resolvedAt: new Date(plainLog.resolvedAt).getTime(),
        sessionIds: plainLog.sessionIds,
        siteId: plainLog.siteId,
        month: plainLog.month,
        year: plainLog.year,
        beforeData: plainLog.beforeData,
        afterData: plainLog.afterData,
      };
    });

    const totalPages = Math.ceil(totalItems / sizeNum);

    return reply.send({
      logs: formattedLogs,
      pagination: {
        page: pageNum,
        size: sizeNum,
        totalPages,
        totalItems,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Failed to retrieve conflict logs',
    });
  }
}

