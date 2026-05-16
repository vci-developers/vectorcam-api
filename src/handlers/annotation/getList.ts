import { FastifyRequest, FastifyReply } from 'fastify';
import { Op, WhereOptions } from 'sequelize';
import { Annotation, AnnotationTask, User, Specimen, Session, Site, SpecimenImage } from '../../db/models';
import { formatAnnotationResponse } from './common';
import { buildSiteSubtreeWhere } from '../site/common';

interface GetAnnotationListQuery {
  page?: number;
  limit?: number;
  taskId?: number;
  annotatorId?: number;
  status?: 'PENDING' | 'ANNOTATED' | 'FLAGGED';
  startDate?: string;
  endDate?: string;
  district?: string;
  siteId?: number;
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
      status: { type: 'string', enum: ['PENDING', 'ANNOTATED', 'FLAGGED'] },
      startDate: { type: 'string', format: 'date', description: 'Filter annotations created from this date (YYYY-MM-DD)' },
      endDate: { type: 'string', format: 'date', description: 'Filter annotations created to this date (YYYY-MM-DD)' },
      district: { type: 'string', description: 'Filter annotations by site district' },
      siteId: { type: 'number', description: 'Filter annotations by site ID' }
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
              visualSpecies: { type: ['string', 'null'] },
              visualSex: { type: ['string', 'null'] },
              visualAbdomenStatus: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
              artifacts: { type: ['string', 'null'] },
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
                  email: { type: 'string' },
                  name: { type: ['string', 'null'] },
                  privilege: { type: 'number' },
                  programId: { type: ['number', 'null'] },
                  isActive: { type: 'boolean' }
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
                  thumbnailImage: {
                    type: ['object', 'null'],
                    properties: {
                      id: { type: 'number' },
                      url: { type: 'string' },
                      metadata: { type: ['object', 'null'], additionalProperties: true },
                      species: { type: ['string', 'null'] },
                      sex: { type: ['string', 'null'] },
                      abdomenStatus: { type: ['string', 'null'] },
                    },
                  },
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
                      collectionCycleId: { type: ['number', 'null'] },
                      latitude: { type: ['number', 'null'] },
                      longitude: { type: ['number', 'null'] },
                      type: { type: 'string' },
                      site: {
                        type: 'object',
                        properties: {
                          siteId: { type: 'number' },
                          programId: { type: 'number' },
                          name: { type: ['string', 'null'] },
                          district: { type: ['string', 'null'] },
                          subCounty: { type: ['string', 'null'] },
                          parish: { type: ['string', 'null'] },
                          villageName: { type: ['string', 'null'] },
                          houseNumber: { type: 'string' },
                          isActive: { type: 'boolean' },
                          healthCenter: { type: ['string', 'null'] },
                          locationHierarchy: {
                            type: 'object',
                            additionalProperties: { type: 'string' }
                          }
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
    },
    400: {
      type: 'object',
      properties: { error: { type: 'string' } }
    }
  }
};

export default async function getAnnotationList(
  request: GetAnnotationListRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { page = 1, limit = 20, taskId, annotatorId, status, startDate, endDate, district, siteId } = request.query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions: any = {};
    const siteWhere: any = { hasData: true };

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
      
      // If taskId is provided, verify it belongs to the user
      if (taskId) {
        if (!userTaskIds.includes(taskId)) {
          // User doesn't have access to this task, return empty result
          return reply.send({
            annotations: [],
            total: 0,
            limit,
            offset,
            hasMore: false
          });
        }
        whereConditions.annotationTaskId = taskId;
      } else {
        whereConditions.annotationTaskId = { [Op.in]: userTaskIds };
      }
    } else if (taskId) {
      // Admin token with taskId filter
      whereConditions.annotationTaskId = taskId;
    }

    if (annotatorId) {
      whereConditions.annotatorId = annotatorId;
    }

    if (status) {
      whereConditions.status = status;
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return reply.code(400).send({ error: 'Start date must be before or equal to end date' });
    }

    // Match the summary endpoint: date filters apply to annotation creation time.
    if (startDate || endDate) {
      whereConditions.createdAt = {};
      if (startDate) {
        whereConditions.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereConditions.createdAt[Op.lte] = new Date(endDate + 'T23:59:59.999Z');
      }
    }

    if (district) {
      siteWhere.district = district;
    }

    if (siteId) {
      const subtreeFragment = buildSiteSubtreeWhere([siteId]);
      if (subtreeFragment) {
        siteWhere[Op.and] = [...((siteWhere[Op.and] as any[]) ?? []), subtreeFragment];
      }
    }

    const annotationIncludes = [
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
        required: true,
        include: [
          {
            model: SpecimenImage,
            as: 'thumbnailImage',
          },
          {
            model: Session,
            as: 'session',
            required: true,
            include: [
              {
                model: Site,
                as: 'site',
                required: true,
                where: siteWhere
              }
            ]
          }
        ]
      }
    ];

    const total = await Annotation.count({
      where: whereConditions,
      include: annotationIncludes,
      distinct: true,
      col: 'id'
    });

    // Fetch annotations with related data
    const annotations = await Annotation.findAll({
      where: whereConditions,
      include: annotationIncludes,
      limit,
      offset,
      order: [['id', 'DESC']]
    });

    // Format response
    const formattedAnnotations = await Promise.all(
      annotations.map(annotation => formatAnnotationResponse(annotation, true))
    );

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
