import { FastifyRequest, FastifyReply } from 'fastify';
import { Annotation, AnnotationTask } from '../../db/models';
import { formatAnnotationResponse } from './common';

interface UpdateAnnotationParams {
  annotationId: number;
}

interface UpdateAnnotationBody {
  morphSpecies?: string;
  morphSex?: string;
  morphAbdomenStatus?: string;
  notes?: string;
  status?: 'PENDING' | 'ANNOTATED' | 'FLAGGED';
}

interface UpdateAnnotationRequest extends FastifyRequest {
  params: UpdateAnnotationParams;
  body: UpdateAnnotationBody;
}

export const schema = {
  params: {
    type: 'object',
    required: ['annotationId'],
    properties: {
      annotationId: { type: 'number' }
    }
  },
  body: {
    type: 'object',
    properties: {
      morphSpecies: { type: 'string', maxLength: 255 },
      morphSex: { type: 'string', maxLength: 50 },
      morphAbdomenStatus: { type: 'string', maxLength: 100 },
      notes: { type: 'string' },
      status: { type: 'string', enum: ['PENDING', 'ANNOTATED', 'FLAGGED'] }
    },
    additionalProperties: false
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        annotation: {
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

export default async function updateAnnotation(
  request: UpdateAnnotationRequest & { isAdminToken?: boolean },
  reply: FastifyReply
): Promise<void> {
  try {
    const { annotationId } = request.params;
    const updates = request.body;

    // Find the annotation with access control
    let annotation;
    if (!request.isAdminToken && request.user) {
      // For superadmin users, check if the annotation belongs to one of their tasks
      annotation = await Annotation.findByPk(annotationId, {
        include: [{
          model: AnnotationTask,
          as: 'annotationTask',
          where: { userId: request.user.id },
          attributes: ['id']
        }]
      });
    } else {
      // Admin token can access any annotation
      annotation = await Annotation.findByPk(annotationId);
    }

    if (!annotation) {
      reply.code(404).send({ error: 'Annotation not found or access denied' });
      return;
    }

    // Update the annotation
    await annotation.update(updates);

    reply.send({
      message: 'Annotation updated successfully',
      annotation: formatAnnotationResponse(annotation)
    });

  } catch (error: any) {
    request.log.error(error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
}
