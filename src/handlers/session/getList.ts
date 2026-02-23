import { FastifyRequest, FastifyReply } from 'fastify';
import { Session, Site } from '../../db/models';
import { formatSessionResponse } from './common';
import { Op, Order } from 'sequelize';

export const schema = {
  tags: ['Sessions'],
  querystring: {
    type: 'object',
    properties: {
      siteId: { type: 'number', description: 'Filter by site ID' },
      programId: { type: 'number', description: 'Filter by program ID' },
      district: { type: 'string', description: 'Filter by district name' },
      deviceId: { type: 'number', description: 'Filter by device ID' },
      frontendId: { type: 'string', description: 'Filter by frontend ID' },
      collectorName: { type: 'string', description: 'Filter by collector name (partial match)' },
      collectionMethod: { type: 'string', description: 'Filter by collection method (partial match)' },
      specimenCondition: { type: 'string', description: 'Filter by specimen condition (partial match)' },
      status: { type: 'string', enum: ['pending', 'completed', 'submitted'], description: 'Filter by session status' },
      type: { type: 'string', enum: ['SURVEILLANCE', 'DATA_COLLECTION'], description: 'Filter by session type' },
      startDate: { type: 'string', format: 'date', description: 'Filter sessions from this date (YYYY-MM-DD)' },
      endDate: { type: 'string', format: 'date', description: 'Filter sessions to this date (YYYY-MM-DD)' },
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
              type: { type: 'string', enum: ['SURVEILLANCE', 'DATA_COLLECTION', ''] },
              collectorLastTrainedOn: { type: ['number', 'null'] },
              hardwareId: { type: ['string', 'null'] },
              totalSpecimens: { type: 'number' }
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
  district?: string;
  deviceId?: number;
  frontendId?: string;
  collectorName?: string;
  collectionMethod?: string;
  specimenCondition?: string;
  status?: 'pending' | 'completed' | 'submitted';
  type?: 'SURVEILLANCE' | 'DATA_COLLECTION';
  startDate?: string;
  endDate?: string;
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
      district,
      deviceId,
      frontendId,
      collectorName,
      collectionMethod,
      specimenCondition,
      status,
      type,
      startDate,
      endDate,
      limit = 20,
      offset = 0,
      sortBy = 'id',
      sortOrder = 'asc'
    } = request.query;

    // Build where clause
    const whereClause: any = {};
    
    // Apply site access restrictions first
    const siteAccess = request.siteAccess;
    let accessibleSiteIds: number[] = [];
    
    if (siteAccess && siteAccess.userSites.length > 0) {
      // User has limited site access
      accessibleSiteIds = siteAccess.userSites;
    }
    
    // If programId or district filter is provided, find matching sites
    if (programId || district) {
      const siteWhere: any = {};
      
      if (programId) {
        siteWhere.programId = programId;
      }
      
      if (district) {
        siteWhere.district = district;
      }
      
      // If user has limited access, intersect with their accessible sites
      if (accessibleSiteIds.length > 0) {
        siteWhere.id = { [Op.in]: accessibleSiteIds };
      }
      
      const matchingSites = await Site.findAll({
        where: siteWhere,
        attributes: ['id']
      });
      
      const matchingSiteIds = matchingSites.map(site => site.id);
      
      if (matchingSiteIds.length === 0) {
        // No matching sites that user has access to
        whereClause.siteId = -1; // Return no results
      } else {
        whereClause.siteId = { [Op.in]: matchingSiteIds };
      }
    } else if (accessibleSiteIds.length > 0) {
      // No programId/district filter, but user has limited access
      whereClause.siteId = { [Op.in]: accessibleSiteIds };
    }
    
    // If user provides a specific siteId filter, apply it (but only if they have access)
    if (siteId) {
      if (accessibleSiteIds.length > 0) {
        // User has limited access - only allow if they have access to this site
        if (accessibleSiteIds.includes(siteId)) {
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
    if (startDate || endDate) {
      whereClause.collectionDate = {};
      if (startDate) {
        whereClause.collectionDate[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.collectionDate[Op.lte] = new Date(endDate + 'T23:59:59.999Z');
      }
    }

    // Build order clause
    const orderClause: Order = [[sortBy, sortOrder.toUpperCase()]];

    const total = await Session.count({
      where: whereClause,
      distinct: true,
      col: 'id'
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