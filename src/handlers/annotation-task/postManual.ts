import { FastifyRequest, FastifyReply } from 'fastify';
import { AnnotationTask, User } from '../../db/models';
import { formatAnnotationTaskResponse } from './common';

interface CreateManualAnnotationTaskBody {
  annotatorId: number;
  title?: string;
  description?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

interface CreateManualAnnotationTaskRequest extends FastifyRequest {
  body: CreateManualAnnotationTaskBody;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Create an annotation task manually',
  description: 'Creates an empty annotation task assigned to a specific annotator (requires admin token)',
  body: {
    type: 'object',
    properties: {
      annotatorId: { type: 'number' },
      title: { type: 'string', maxLength: 255 },
      description: { type: 'string' },
      status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] }
    },
    required: ['annotatorId'],
    additionalProperties: false
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        task: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            annotatorId: { type: 'number' },
            title: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            status: { type: 'string' },
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
        }
      }
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' }
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

export default async function createManualAnnotationTask(
  request: CreateManualAnnotationTaskRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { annotatorId, title, description, status } = request.body;

    if (!Number.isInteger(annotatorId) || annotatorId <= 0) {
      return reply.code(400).send({ error: 'annotatorId must be a positive integer' });
    }

    const annotator = await User.findByPk(annotatorId);
    if (!annotator) {
      return reply.code(404).send({ error: `User not found with ID: ${annotatorId}` });
    }

    if (!annotator.isActive) {
      return reply.code(400).send({ error: `User ${annotatorId} is not active` });
    }

    const task = await AnnotationTask.create({
      userId: annotatorId,
      title: title ?? `Annotation Task - ${new Date().toISOString().split('T')[0]}`,
      description: description ?? `Manual annotation task for ${annotator.email}`,
      status: status ?? 'PENDING'
    });

    const taskWithUser = await AnnotationTask.findByPk(task.id, {
      include: [{ model: User, as: 'user' }]
    });

    return reply.send({
      message: 'Annotation task created successfully',
      task: formatAnnotationTaskResponse(taskWithUser!, true)
    });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
