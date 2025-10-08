import { FastifyRequest, FastifyReply } from 'fastify';
import { Session, Site } from '../../db/models';
import { Op } from 'sequelize';

interface QueryParams {
  startDate?: string;
  endDate?: string;
  district?: string;
  limit?: number;
  offset?: number;
}

interface ReviewGroup {
  district: string;
  year: number;
  month: number;
  sessionCount: number;
}

export const schema = {
  tags: ['Sessions'],
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string', format: 'date', description: 'Filter sessions from this date (YYYY-MM-DD)' },
      endDate: { type: 'string', format: 'date', description: 'Filter sessions to this date (YYYY-MM-DD)' },
      district: { type: 'string', description: 'Filter by district name' },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20, description: 'Number of items per page' },
      offset: { type: 'number', minimum: 0, default: 0, description: 'Number of items to skip' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        reviews: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              district: { type: 'string' },
              year: { type: 'integer' },
              month: { type: 'integer' },
              sessionCount: { type: 'integer' }
            }
          }
        },
        districts: {
          type: 'array',
          items: { type: 'string' }
        },
        total: { type: 'integer' },
        limit: { type: 'integer' },
        offset: { type: 'integer' },
        hasMore: { type: 'boolean' }
      }
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export async function getSessionReviewTask(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const {
      startDate,
      endDate,
      district,
      limit = 20,
      offset = 0
    } = request.query;

    // Build site where clause for access control
    const siteWhereClause: any = {};
    const siteAccess = request.siteAccess;
    
    if (siteAccess && siteAccess.userSites.length > 0) {
      // User has limited site access, restrict to their sites
      siteWhereClause.id = {
        [Op.in]: siteAccess.userSites
      };
    }

    // Add district filter if provided
    if (district) {
      siteWhereClause.district = district;
    }

    // Build session where clause for date filtering
    const sessionWhereClause: any = {};
    
    if (startDate || endDate) {
      sessionWhereClause.collectionDate = {};
      if (startDate) {
        sessionWhereClause.collectionDate[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        sessionWhereClause.collectionDate[Op.lte] = new Date(endDate + 'T23:59:59.999Z');
      }
    }

    // Get all sessions with site information for grouping
    const sessions = await Session.findAll({
      where: sessionWhereClause,
      include: [{
        model: Site,
        as: 'site',
        where: siteWhereClause,
        attributes: ['district'],
        required: true
      }],
      attributes: ['id', 'collectionDate'],
      raw: true
    });

    // Group sessions by district and month
    const groupMap = new Map<string, ReviewGroup>();
    const distinctDistricts = new Set<string>();

    sessions.forEach((session: any) => {
      const district = session['site.district'];
      const collectionDate = session.collectionDate;

      if (!district || !collectionDate) {
        return;
      }

      distinctDistricts.add(district);

      // Extract year and month
      const date = new Date(collectionDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 1-12

      const key = `${district}|${year}|${month}`;

      if (groupMap.has(key)) {
        const group = groupMap.get(key)!;
        group.sessionCount += 1;
      } else {
        groupMap.set(key, {
          district,
          year,
          month,
          sessionCount: 1
        });
      }
    });

    // Convert map to array and sort by collection date (descending) - most recent first
    const allReviews = Array.from(groupMap.values()).sort((a, b) => {
      // Sort by year descending first
      if (a.year !== b.year) {
        return b.year - a.year;
      }
      // Then by month descending
      if (a.month !== b.month) {
        return b.month - a.month;
      }
      // Then by district ascending
      return a.district.localeCompare(b.district);
    });

    // Apply pagination
    const total = allReviews.length;
    const paginatedReviews = allReviews.slice(offset, offset + limit);

    // Get list of all districts (sorted)
    const districts = Array.from(distinctDistricts).sort();

    return reply.code(200).send({
      reviews: paginatedReviews,
      districts,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
