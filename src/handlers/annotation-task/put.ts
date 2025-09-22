import { FastifyRequest, FastifyReply } from 'fastify';
import { AnnotationTask } from '../../db/models';
import { formatAnnotationTaskResponse } from './common';

interface UpdateAnnotationTaskParams {
  taskId: number;
}

interface UpdateAnnotationTaskBody {
  title?: string;
  description?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

interface UpdateAnnotationTaskRequest extends FastifyRequest {
  params: UpdateAnnotationTaskParams;
  body: UpdateAnnotationTaskBody;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Update annotation task',
  description: 'Update annotation task data (requires admin token or superadmin user access - superadmin users can only update status)',
  params: {
    type: 'object',
    required: ['taskId'],
    properties: {
      taskId: { type: 'number' }
    }
  },
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', maxLength: 255 },
      description: { type: 'string' },
      status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] }
    },
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
            userId: { type: 'number' },
            title: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            status: { type: 'string' },
            createdAt: { type: 'number' },
            updatedAt: { type: 'number' }
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

export default async function updateAnnotationTask(
  request: UpdateAnnotationTaskRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { taskId } = request.params;
    const updates = request.body;

    // Find the annotation task with access control
    let task;
    if (!request.isAdminToken && request.user) {
      // For superadmin users, check if they own the task
      task = await AnnotationTask.findOne({
        where: { 
          id: taskId,
          userId: request.user.id 
        }
      });
      
      if (!task) {
        return reply.code(404).send({ error: 'Annotation task not found or access denied' });
      }
      
      // Superadmin users can only update status
      const allowedFields = ['status'];
      const filteredUpdates: Partial<typeof updates> = {};
      
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          (filteredUpdates as any)[key] = value;
        }
      }
      
      if (Object.keys(filteredUpdates).length === 0) {
        return reply.code(400).send({ error: 'Superadmin users can only update status field' });
      }
      
      // Update with filtered fields
      await task.update(filteredUpdates);
    } else {
      // Admin token can access and update any task with any fields
      task = await AnnotationTask.findByPk(taskId);
      
      if (!task) {
        return reply.code(404).send({ error: 'Annotation task not found' });
      }
      
      // Update the task with all provided fields
      await task.update(updates);
    }

    return reply.send({
      message: 'Annotation task updated successfully',
      task: formatAnnotationTaskResponse(task)
    });

  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
