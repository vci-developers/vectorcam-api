import { FastifyRequest, FastifyReply } from 'fastify';
import { Op, WhereOptions } from 'sequelize';
import { AnnotationTask, User } from '../../db/models';
import { formatAnnotationTaskResponse } from './common';

interface GetAnnotationTaskListQuery {
  page?: number;
  limit?: number;
  createdAfter?: string; // ISO date string for filtering after this date
  createdBefore?: string; // ISO date string for filtering before this date
  title?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

interface GetAnnotationTaskListRequest extends FastifyRequest {
  query: GetAnnotationTaskListQuery;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Get annotation tasks list',
  description: 'Get list of annotation tasks with filtering and pagination (requires admin token or superadmin user access)',
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      createdAfter: { type: 'string', format: 'date-time' },
      createdBefore: { type: 'string', format: 'date-time' },
      title: { type: 'string' },
      status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              userId: { type: 'number' },
              title: { type: ['string', 'null'] },
              description: { type: ['string', 'null'] },
              status: { type: 'string' },
              createdAt: { type: 'number' },
              updatedAt: { type: 'number' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  email: { type: 'string' }
                }
              }
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

export default async function getAnnotationTaskList(
  request: GetAnnotationTaskListRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { page = 1, limit = 20, createdAfter, createdBefore, title, status } = request.query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions: WhereOptions = {};

    // If admin token: show all tasks
    // If superadmin user (privilege = 2): only show their own tasks
    if (!request.isAdminToken && request.user) {
      // Superadmin user - only their own tasks
      whereConditions.userId = request.user.id;
    }
    // If isAdminToken is true, no user filtering (show all tasks)

    // Add filters
    if (createdAfter || createdBefore) {
      const dateFilter: any = {};
      
      if (createdAfter) {
        dateFilter[Op.gte] = new Date(createdAfter);
      }
      
      if (createdBefore) {
        dateFilter[Op.lte] = new Date(createdBefore);
      }
      
      whereConditions.createdAt = dateFilter;
    }

    if (title) {
      whereConditions.title = {
        [Op.iLike]: `%${title}%`
      };
    }

    if (status) {
      whereConditions.status = status;
    }

    // Get total count for pagination
    const total = await AnnotationTask.count({
      where: whereConditions
    });

    // Fetch annotation tasks with user details
    const tasks = await AnnotationTask.findAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user'
        }
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Format response
    const formattedTasks = tasks.map(task => formatAnnotationTaskResponse(task, true));

    return reply.send({
      tasks: formattedTasks,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });

  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
