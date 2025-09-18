import { FastifyRequest, FastifyReply } from 'fastify';
import { Session } from '../../db/models';
import { formatSessionResponse } from './common';
import { Op, Order } from 'sequelize';

export const schema = {
  tags: ['Sessions'],
  querystring: {
    type: 'object',
    properties: {
      siteId: { type: 'number', description: 'Filter by site ID' },
      programId: { type: 'number', description: 'Filter by program ID' },
      deviceId: { type: 'number', description: 'Filter by device ID' },
      frontendId: { type: 'string', description: 'Filter by frontend ID' },
      collectorName: { type: 'string', description: 'Filter by collector name (partial match)' },
      collectionMethod: { type: 'string', description: 'Filter by collection method (partial match)' },
      specimenCondition: { type: 'string', description: 'Filter by specimen condition (partial match)' },
      status: { type: 'string', enum: ['pending', 'completed', 'submitted'], description: 'Filter by session status' },
      type: { type: 'string', enum: ['SURVEILLANCE', 'DATA_COLLECTION'], description: 'Filter by session type' },
      dateFrom: { type: 'string', format: 'date', description: 'Filter sessions from this date (YYYY-MM-DD)' },
      dateTo: { type: 'string', format: 'date', description: 'Filter sessions to this date (YYYY-MM-DD)' },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20, description: 'Number of items per page' },
      offset: { type: 'number', minimum: 0, default: 0, description: 'Number of items to skip' },
      sortBy: { type: 'string', enum: ['id', 'frontendId', 'createdAt', 'completedAt', 'submittedAt', 'collectionDate'], default: 'id', description: 'Field to sort by' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc', description: 'Sort order' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sessionId: { type: 'number' },
              frontendId: { type: 'string' },
              collectorTitle: { type: 'string', nullable: true },
              collectorName: { type: 'string', nullable: true },
              collectionDate: { type: 'number', nullable: true },
              collectionMethod: { type: 'string', nullable: true },
              specimenCondition: { type: 'string', nullable: true },
              createdAt: { type: ['number', 'null'] },
              completedAt: { type: 'number', nullable: true },
              submittedAt: { type: 'number' },
              notes: { type: 'string', nullable: true },
              siteId: { type: 'number' },
              deviceId: { type: 'number' },
              latitude: { type: ['number', 'null'] },
              longitude: { type: ['number', 'null'] },
              type: { type: 'string', enum: ['SURVEILLANCE', 'DATA_COLLECTION', ''] }
            }
          }
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' },
        hasMore: { type: 'boolean' }
      }
    }
  }
};

interface QueryParams {
  siteId?: number;
  programId?: number;
  deviceId?: number;
  frontendId?: string;
  collectorName?: string;
  collectionMethod?: string;
  specimenCondition?: string;
  status?: 'pending' | 'completed' | 'submitted';
  type?: 'SURVEILLANCE' | 'DATA_COLLECTION';
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'id' | 'frontendId' | 'createdAt' | 'completedAt' | 'submittedAt' | 'collectionDate';
  sortOrder?: 'asc' | 'desc';
}

export async function getSessionList(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    const {
      siteId,
      programId,
      deviceId,
      frontendId,
      collectorName,
      collectionMethod,
      specimenCondition,
      status,
      type,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0,
      sortBy = 'id',
      sortOrder = 'asc'
    } = request.query;

    // Build where clause
    const whereClause: any = {};
    
    // Apply site access restrictions first
    const siteAccess = request.siteAccess;
    if (siteAccess && siteAccess.userSites.length > 0) {
      // User has limited site access, restrict to their sites
      whereClause.siteId = {
        [Op.in]: siteAccess.userSites
      };
    }
    
    // If user provides a specific siteId filter, apply it (but only if they have access)
    if (siteId) {
      if (siteAccess && siteAccess.userSites.length > 0) {
        // User has limited access - only allow if they have access to this site
        if (siteAccess.userSites.includes(siteId)) {
          whereClause.siteId = siteId;
        } else {
          // User doesn't have access to this site - return empty result
          whereClause.siteId = -1; // This will return no results
        }
      } else {
        // User has full access or admin/mobile token
        whereClause.siteId = siteId;
      }
    }
    if (deviceId) {
      whereClause.deviceId = deviceId;
    }
    if (frontendId) {
      whereClause.frontendId = frontendId;
    }
    if (collectorName) {
      whereClause.collectorName = {
        [Op.like]: `%${collectorName}%`
      };
    }
    if (collectionMethod) {
      whereClause.collectionMethod = {
        [Op.like]: `%${collectionMethod}%`
      };
    }
    if (specimenCondition) {
      whereClause.specimenCondition = {
        [Op.like]: `%${specimenCondition}%`
      };
    }
    if (type) {
      whereClause.type = type;
    }

    // Handle status filtering
    if (status) {
      switch (status) {
        case 'pending':
          whereClause.completedAt = null;
          break;
        case 'completed':
          whereClause.completedAt = { [Op.ne]: null };
          break;
        case 'submitted':
          // All sessions are submitted by default, so no additional filter needed
          break;
      }
    }

    // Handle date range filtering
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) {
        whereClause.createdAt[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.createdAt[Op.lte] = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    // Build order clause
    const orderClause: Order = [[sortBy, sortOrder.toUpperCase()]];

    // Get total count
    const total = await Session.count({
      where: whereClause
    });

    // Get sessions with pagination
    const sessions = await Session.findAll({
      where: whereClause,
      order: orderClause,
      limit,
      offset
    });

    // Format response
    const formattedSessions = sessions.map(session => formatSessionResponse(session));

    return reply.send({
      sessions: formattedSessions,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Internal Server Error' });
    return;
  }
} 