import { FastifyRequest, FastifyReply } from 'fastify';
import { AnnotationTask, Annotation } from '../../db/models';

interface DeleteAnnotationTaskParams {
  taskId: number;
}

interface DeleteAnnotationTaskRequest extends FastifyRequest {
  params: DeleteAnnotationTaskParams;
}

export const schema = {
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
      reply.code(404).send({
        success: false,
        error: 'Annotation task not found'
      });
      return;
    }

    // Check if there are any annotations associated with this task
    const annotationCount = await Annotation.count({
      where: { annotationTaskId: taskId }
    });

    if (annotationCount > 0) {
      reply.code(400).send({
        success: false,
        error: `Cannot delete annotation task. It has ${annotationCount} associated annotations.`
      });
      return;
    }

    // Delete the task
    await task.destroy();

    reply.send({
      message: 'Annotation task deleted successfully'
    });

  } catch (error: any) {
    request.log.error(error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
}
