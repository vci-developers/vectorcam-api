import { FastifyRequest, FastifyReply } from 'fastify';
import { AnnotationTask, Annotation } from '../../db/models';

interface DeleteAnnotationTaskParams {
  taskId: number;
}

interface DeleteAnnotationTaskRequest extends FastifyRequest {
  params: DeleteAnnotationTaskParams;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Delete annotation task',
  description: 'Delete annotation task (requires admin token only)',
  params: {
    type: 'object',
    required: ['taskId'],
    properties: {
      taskId: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
};

export default async function deleteAnnotationTask(
  request: DeleteAnnotationTaskRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { taskId } = request.params;

    // Find the annotation task
    const task = await AnnotationTask.findByPk(taskId);

    if (!task) {
      return reply.code(404).send({ error: 'Annotation task not found' });
    }

    // Check if there are any annotations associated with this task
    const annotationCount = await Annotation.count({
      where: { annotationTaskId: taskId }
    });

    if (annotationCount > 0) {
      return reply.code(400).send({ error: `Cannot delete annotation task. It has ${annotationCount} associated annotations.` });
    }

    // Delete the task
    await task.destroy();

    return reply.send({
      message: 'Annotation task deleted successfully'
    });

  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
