import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { AnnotationTask, Annotation, User } from '../../db/models';
import { formatAnnotationTaskResponse } from './common';
import { viewableTaskOwnerIds } from '../annotation/access';

interface GetAnnotationTaskParams {
  annotationTaskId: number;
}

interface GetAnnotationTaskRequest extends FastifyRequest {
  params: GetAnnotationTaskParams;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Get annotation task details',
  description: 'Get annotation task by ID with annotation counts (requires annotation:annotate, annotation:read, or annotation:manage; annotators without read or manage only see their own tasks)',
  params: {
    type: 'object',
    required: ['annotationTaskId'],
    properties: {
      annotationTaskId: { type: 'number' }
    }
  },
  response: {
    200: {
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
            name: { type: ['string', 'null'] },
            privilege: { type: 'number' },
            programId: { type: ['number', 'null'] },
            isActive: { type: 'boolean' }
          }
        }
      }
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export default async function getAnnotationTask(
  request: GetAnnotationTaskRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { annotationTaskId } = request.params;

    const whereClause: Record<string, unknown> = { id: annotationTaskId };
    const ownerIds = await viewableTaskOwnerIds(request);
    if (ownerIds !== null) {
      whereClause.userId = { [Op.in]: ownerIds };
    }

    const task = await AnnotationTask.findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user'
        }
      ]
    });

    if (!task) {
      return reply.code(404).send({ error: 'Annotation task not found or access denied' });
    }

    const [total, pending, annotated, flagged] = await Promise.all([
      Annotation.count({ where: { annotationTaskId } }),
      Annotation.count({ where: { annotationTaskId, status: 'PENDING' } }),
      Annotation.count({ where: { annotationTaskId, status: 'ANNOTATED' } }),
      Annotation.count({ where: { annotationTaskId, status: 'FLAGGED' } })
    ]);

    return reply.send({
      ...formatAnnotationTaskResponse(task, true),
      annotationCounts: {
        total,
        pending,
        annotated,
        flagged
      }
    });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
