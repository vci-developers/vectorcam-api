import { FastifyRequest, FastifyReply } from 'fastify';
import { Transaction, Op } from 'sequelize';
import sequelize from '../../db';
import { AnnotationTask, Annotation } from '../../db/models';

interface BulkDeleteAnnotationsParams {
  taskId: number;
}

interface BulkDeleteAnnotationsQuery {
  annotationIds: string;
}

interface BulkDeleteAnnotationsRequest extends FastifyRequest {
  params: BulkDeleteAnnotationsParams;
  query: BulkDeleteAnnotationsQuery;
}

function parseAnnotationIdsParam(value?: string): number[] {
  if (!value) return [];
  return Array.from(new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => Number(entry))
      .filter((id) => Number.isInteger(id) && id > 0)
  ));
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Bulk delete annotations from a task',
  description: 'Deletes annotations by ID under a specific annotation task (requires admin token)',
  params: {
    type: 'object',
    required: ['taskId'],
    properties: {
      taskId: { type: 'number' }
    }
  },
  querystring: {
    type: 'object',
    required: ['annotationIds'],
    properties: {
      annotationIds: {
        type: 'string',
        description: 'Comma-separated annotation IDs to delete'
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        deleted: { type: 'number' },
        notFound: { type: 'number' },
        notFoundIds: {
          type: 'array',
          items: { type: 'number' }
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

export default async function bulkDeleteAnnotations(
  request: BulkDeleteAnnotationsRequest,
  reply: FastifyReply
): Promise<void> {
  const transaction: Transaction = await sequelize.transaction();

  try {
    const { taskId } = request.params;
    const uniqueAnnotationIds = parseAnnotationIdsParam(request.query.annotationIds);

    if (uniqueAnnotationIds.length === 0) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'annotationIds must contain at least one valid annotation ID' });
    }

    const task = await AnnotationTask.findByPk(taskId, { transaction });
    if (!task) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Annotation task not found' });
    }

    const annotations = await Annotation.findAll({
      where: {
        id: { [Op.in]: uniqueAnnotationIds },
        annotationTaskId: taskId
      },
      attributes: ['id'],
      transaction
    });

    const foundIds = new Set(annotations.map(a => a.id));
    const notFoundIds = uniqueAnnotationIds.filter(id => !foundIds.has(id));

    const deleted = await Annotation.destroy({
      where: {
        id: { [Op.in]: [...foundIds] },
        annotationTaskId: taskId
      },
      transaction
    });

    await transaction.commit();

    return reply.send({
      message: 'Annotations deleted successfully',
      deleted,
      notFound: notFoundIds.length,
      notFoundIds
    });
  } catch (error: any) {
    await transaction.rollback();
    request.log.error(error);

    if (!reply.sent) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }
}
