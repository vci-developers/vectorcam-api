import { FastifyRequest, FastifyReply } from 'fastify';
import { Transaction } from 'sequelize';
import sequelize from '../../db';
import { AnnotationTask, Annotation } from '../../db/models';

interface DeleteAnnotationTaskParams {
  taskId: number;
}

interface DeleteAnnotationTaskQuery {
  force?: boolean;
}

interface DeleteAnnotationTaskRequest extends FastifyRequest {
  params: DeleteAnnotationTaskParams;
  query: DeleteAnnotationTaskQuery;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Delete annotation task',
  description: 'Delete annotation task. Pass force=true to delete all associated annotations first (requires admin token only)',
  params: {
    type: 'object',
    required: ['taskId'],
    properties: {
      taskId: { type: 'number' }
    }
  },
  querystring: {
    type: 'object',
    properties: {
      force: {
        type: 'boolean',
        description: 'When true, deletes all annotations on the task before deleting the task'
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        deletedAnnotations: { type: 'number' }
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
  const transaction: Transaction = await sequelize.transaction();

  try {
    const { taskId } = request.params;
    const force = request.query.force === true;

    const task = await AnnotationTask.findByPk(taskId, { transaction });

    if (!task) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Annotation task not found' });
    }

    const annotationCount = await Annotation.count({
      where: { annotationTaskId: taskId },
      transaction
    });

    if (annotationCount > 0 && !force) {
      await transaction.rollback();
      return reply.code(400).send({
        error: `Cannot delete annotation task. It has ${annotationCount} associated annotations. Pass force=true to delete them first.`
      });
    }

    let deletedAnnotations = 0;
    if (annotationCount > 0) {
      deletedAnnotations = await Annotation.destroy({
        where: { annotationTaskId: taskId },
        transaction
      });
    }

    await task.destroy({ transaction });

    await transaction.commit();

    return reply.send({
      message: 'Annotation task deleted successfully',
      deletedAnnotations
    });

  } catch (error: any) {
    await transaction.rollback();
    request.log.error(error);
    if (!reply.sent) {
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  }
}
