import { FastifyRequest, FastifyReply } from 'fastify';
import { Op, WhereOptions, fn, col, literal } from 'sequelize';
import { AnnotationTask, Annotation, User } from '../../db/models';
import { formatAnnotationTaskResponse } from './common';

interface GetAnnotationTaskListQuery {
  page?: number;
  limit?: number;
  startDate?: string; // ISO date string (YYYY-MM-DD) for filtering after this date
  endDate?: string; // ISO date string (YYYY-MM-DD) for filtering before this date
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
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
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
              annotatorId: { type: 'number' },
              title: { type: ['string', 'null'] },
              description: { type: ['string', 'null'] },
              status: { type: 'string' },
              annotationCounts: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  pending: { type: 'number' },
                  annotated: { type: 'number' },
                  flagged: { type: 'number' }
                }
              },
              createdAt: { type: 'number' },
              updatedAt: { type: 'number' },
              annotator: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  email: { type: 'string' },
                  privilege: { type: 'number' },
                  programId: { type: ['number', 'null'] },
                  isActive: { type: 'boolean' }
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
    const { page = 1, limit = 20, startDate, endDate, title, status } = request.query;
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
    if (startDate || endDate) {
      const dateFilter: any = {};
      
      if (startDate) {
        dateFilter[Op.gte] = new Date(`${startDate}T00:00:00.000Z`);
      }
      
      if (endDate) {
        dateFilter[Op.lte] = new Date(`${endDate}T23:59:59.999Z`);
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

    const total = await AnnotationTask.count({
      where: whereConditions,
      distinct: true,
      col: 'id'
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

    const taskIds = tasks.map(task => task.id);
    const defaultCounts = {
      total: 0,
      pending: 0,
      annotated: 0,
      flagged: 0
    };
    const countsByTaskId = new Map<number, typeof defaultCounts>();

    if (taskIds.length > 0) {
      const annotationCountsRaw = await Annotation.findAll({
        attributes: [
          'annotationTaskId',
          [fn('COUNT', col('id')), 'total'],
          [fn('SUM', literal(`CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END`)), 'pending'],
          [fn('SUM', literal(`CASE WHEN status = 'ANNOTATED' THEN 1 ELSE 0 END`)), 'annotated'],
          [fn('SUM', literal(`CASE WHEN status = 'FLAGGED' THEN 1 ELSE 0 END`)), 'flagged']
        ],
        where: {
          annotationTaskId: {
            [Op.in]: taskIds
          }
        },
        group: ['annotation_task_id'],
        raw: true
      });

      const annotationCounts = annotationCountsRaw as unknown as Array<{
        annotationTaskId: number;
        total: string | number;
        pending: string | number;
        annotated: string | number;
        flagged: string | number;
      }>;

      for (const row of annotationCounts) {
        countsByTaskId.set(Number(row.annotationTaskId), {
          total: Number(row.total) || 0,
          pending: Number(row.pending) || 0,
          annotated: Number(row.annotated) || 0,
          flagged: Number(row.flagged) || 0
        });
      }
    }

    // Format response
    const formattedTasks = tasks.map(task => ({
      ...formatAnnotationTaskResponse(task, true),
      annotationCounts: countsByTaskId.get(task.id) || defaultCounts
    }));

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
