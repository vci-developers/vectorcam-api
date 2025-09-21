import { FastifyRequest, FastifyReply } from 'fastify';
import { Op, WhereOptions } from 'sequelize';
import { Annotation, AnnotationTask, User, Specimen, Session, Site } from '../../db/models';
import { formatAnnotationResponse } from './common';

interface GetAnnotationListQuery {
  page?: number;
  limit?: number;
  taskId?: number;
  annotatorId?: number;
  status?: 'PENDING' | 'ANNOTATED' | 'FLAGGED';
}

interface GetAnnotationListRequest extends FastifyRequest {
  query: GetAnnotationListQuery;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Get annotations list',
  description: 'Get list of annotations with filtering and pagination (requires admin token or superadmin user access)',
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      taskId: { type: 'integer' },
      annotatorId: { type: 'integer' },
      status: { type: 'string', enum: ['PENDING', 'ANNOTATED', 'FLAGGED'] }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        annotations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              annotationTaskId: { type: 'number' },
              annotatorId: { type: 'number' },
              specimenId: { type: 'number' },
              morphSpecies: { type: ['string', 'null'] },
              morphSex: { type: ['string', 'null'] },
              morphAbdomenStatus: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
              status: { type: 'string' },
              createdAt: { type: 'number' },
              updatedAt: { type: 'number' },
              annotationTask: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  userId: { type: 'number' },
                  title: { type: ['string', 'null'] },
                  description: { type: ['string', 'null'] },
                  status: { type: 'string' },
                  createdAt: { type: 'number' },
                  updatedAt: { type: 'number' }
                }
              },
              annotator: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  email: { type: 'string' }
                }
              },
              specimen: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  specimenId: { type: 'string' },
                  sessionId: { type: 'number' },
                  thumbnailUrl: { type: ['string', 'null'] },
                  thumbnailImageId: { type: ['number', 'null'] },
                  session: {
                    type: 'object',
                    properties: {
                      sessionId: { type: 'number' },
                      frontendId: { type: 'string' },
                      collectorTitle: { type: ['string', 'null'] },
                      collectorName: { type: ['string', 'null'] },
                      collectionDate: { type: ['number', 'null'] },
                      collectionMethod: { type: ['string', 'null'] },
                      specimenCondition: { type: ['string', 'null'] },
                      createdAt: { type: ['number', 'null'] },
                      completedAt: { type: ['number', 'null'] },
                      submittedAt: { type: 'number' },
                      notes: { type: ['string', 'null'] },
                      siteId: { type: 'number' },
                      deviceId: { type: 'number' },
                      latitude: { type: ['number', 'null'] },
                      longitude: { type: ['number', 'null'] },
                      type: { type: 'string' },
                      site: {
                        type: 'object',
                        properties: {
                          siteId: { type: 'number' },
                          programId: { type: 'number' },
                          district: { type: ['string', 'null'] },
                          subCounty: { type: ['string', 'null'] },
                          parish: { type: ['string', 'null'] },
                          villageName: { type: ['string', 'null'] },
                          houseNumber: { type: 'string' },
                          isActive: { type: 'boolean' },
                          healthCenter: { type: ['string', 'null'] }
                        }
                      }
                    }
                  }
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

export default async function getAnnotationList(
  request: GetAnnotationListRequest & { isAdminToken?: boolean },
  reply: FastifyReply
): Promise<void> {
  try {
    const { page = 1, limit = 20, taskId, annotatorId, status } = request.query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions: WhereOptions = {};

    // If admin token: show all annotations
    // If superadmin user: only show annotations for their own tasks
    if (!request.isAdminToken && request.user) {
      // For superadmin users, we need to filter by their annotation tasks
      const userTasks = await AnnotationTask.findAll({
        where: { userId: request.user.id },
        attributes: ['id']
      });
      const userTaskIds = userTasks.map((task: any) => task.id);
      
      if (userTaskIds.length === 0) {
        // User has no tasks, return empty result
        return reply.send({
          annotations: [],
          total: 0,
          limit,
          offset,
          hasMore: false
        });
      }
      
      whereConditions.annotationTaskId = { [Op.in]: userTaskIds };
    }

    if (taskId) {
      whereConditions.annotationTaskId = taskId;
    }

    if (annotatorId) {
      whereConditions.annotatorId = annotatorId;
    }

    if (status) {
      whereConditions.status = status;
    }

    // Get total count for pagination
    const total = await Annotation.count({
      where: whereConditions
    });

    // Fetch annotations with related data
    const annotations = await Annotation.findAll({
      where: whereConditions,
      include: [
        {
          model: AnnotationTask,
          as: 'annotationTask'
        },
        {
          model: User,
          as: 'annotator'
        },
        {
          model: Specimen,
          as: 'specimen',
          include: [
            {
              model: Session,
              as: 'session',
              include: [
                {
                  model: Site,
                  as: 'site'
                }
              ]
            }
          ]
        }
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Format response
    const formattedAnnotations = annotations.map(annotation => formatAnnotationResponse(annotation, true));

    return reply.code(200).send({
      annotations: formattedAnnotations,
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
