import { FastifyRequest, FastifyReply } from 'fastify';
import { Transaction, Op } from 'sequelize';
import sequelize from '../../db';
import { AnnotationTask, Annotation, Specimen } from '../../db/models';
import { formatAnnotationResponse } from '../annotation/common';

interface BulkAddAnnotationsParams {
  taskId: number;
}

interface BulkAddAnnotationsBody {
  specimenIds: number[];
}

interface BulkAddAnnotationsRequest extends FastifyRequest {
  params: BulkAddAnnotationsParams;
  body: BulkAddAnnotationsBody;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Bulk add specimens as empty annotations to a task',
  description: 'Creates PENDING annotations for the given specimens under an annotation task (requires admin token)',
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
      specimenIds: {
        type: 'array',
        items: { type: 'number' },
        minItems: 1
      }
    },
    required: ['specimenIds'],
    additionalProperties: false
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        created: { type: 'number' },
        skipped: { type: 'number' },
        skippedSpecimenIds: {
          type: 'array',
          items: { type: 'number' }
        },
        annotations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              annotationTaskId: { type: 'number' },
              annotatorId: { type: 'number' },
              specimenId: { type: 'number' },
              status: { type: 'string' },
              createdAt: { type: 'number' },
              updatedAt: { type: 'number' }
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

export default async function bulkAddAnnotations(
  request: BulkAddAnnotationsRequest,
  reply: FastifyReply
): Promise<void> {
  const transaction: Transaction = await sequelize.transaction();

  try {
    const { taskId } = request.params;
    const { specimenIds } = request.body;

    const uniqueSpecimenIds = [...new Set(specimenIds)];
    if (uniqueSpecimenIds.length === 0) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'specimenIds must contain at least one specimen ID' });
    }

    if (uniqueSpecimenIds.some(id => !Number.isInteger(id) || id <= 0)) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'All specimenIds must be positive integers' });
    }

    const task = await AnnotationTask.findByPk(taskId, { transaction });
    if (!task) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Annotation task not found' });
    }

    const specimens = await Specimen.findAll({
      where: { id: { [Op.in]: uniqueSpecimenIds } },
      attributes: ['id'],
      transaction
    });

    const foundSpecimenIds = new Set(specimens.map(s => s.id));
    const missingSpecimenIds = uniqueSpecimenIds.filter(id => !foundSpecimenIds.has(id));
    if (missingSpecimenIds.length > 0) {
      await transaction.rollback();
      return reply.code(400).send({
        error: `Specimens not found: ${missingSpecimenIds.join(', ')}`
      });
    }

    const existingAnnotations = await Annotation.findAll({
      where: {
        annotationTaskId: taskId,
        specimenId: { [Op.in]: uniqueSpecimenIds }
      },
      attributes: ['specimenId'],
      transaction
    });

    const alreadyAssignedIds = new Set(existingAnnotations.map(a => a.specimenId));
    const specimenIdsToAdd = uniqueSpecimenIds.filter(id => !alreadyAssignedIds.has(id));

    if (specimenIdsToAdd.length > 0) {
      await Annotation.bulkCreate(
        specimenIdsToAdd.map(specimenId => ({
          annotationTaskId: taskId,
          annotatorId: task.userId,
          specimenId,
          status: 'PENDING'
        })),
        { transaction }
      );
    }

    const createdAnnotations = specimenIdsToAdd.length > 0
      ? await Annotation.findAll({
          where: {
            annotationTaskId: taskId,
            specimenId: { [Op.in]: specimenIdsToAdd }
          },
          transaction
        })
      : [];

    await transaction.commit();

    const formattedAnnotations = await Promise.all(
      createdAnnotations.map(annotation => formatAnnotationResponse(annotation))
    );

    return reply.send({
      message: 'Annotations added successfully',
      created: createdAnnotations.length,
      skipped: alreadyAssignedIds.size,
      skippedSpecimenIds: [...alreadyAssignedIds],
      annotations: formattedAnnotations
    });
  } catch (error: any) {
    await transaction.rollback();
    request.log.error(error);

    if (!reply.sent) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }
}
