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
  visualSpecies?: string;
  visualSex?: string;
  visualAbdomenStatus?: string;
  notes?: string;
  status?: 'PENDING' | 'ANNOTATED' | 'FLAGGED';
}

interface UpdateAnnotationRequest extends FastifyRequest {
  params: UpdateAnnotationParams;
  body: UpdateAnnotationBody;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Update annotation',
  description: 'Update annotation data (requires admin token or superadmin user access)',
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
      visualSpecies: { type: 'string', maxLength: 255 },
      visualSex: { type: 'string', maxLength: 50 },
      visualAbdomenStatus: { type: 'string', maxLength: 100 },
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
            visualSpecies: { type: ['string', 'null'] },
            visualSex: { type: ['string', 'null'] },
            visualAbdomenStatus: { type: ['string', 'null'] },
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
  request: UpdateAnnotationRequest,
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
        }]
      });
    } else {
      // Admin token can access any annotation
      annotation = await Annotation.findByPk(annotationId, {
        include: [{
          model: AnnotationTask,
          as: 'annotationTask',
        }]
      });
    }

    if (!annotation) {
      return reply.code(404).send({ error: 'Annotation not found or access denied' });
    }

    // Update the annotation
    await annotation.update(updates);

    // Always update the annotation task's updatedAt timestamp by setting a field to itself
    const annotationTaskId = annotation.annotationTaskId;
    try {
      const annotationTask = await AnnotationTask.findByPk(annotationTaskId);
      
      if (annotationTask) {
        await annotationTask.update({ updatedAt: new Date() });
      }
    } catch (taskUpdateError: any) {
      // Log the error but don't fail the annotation update
      request.log.warn(`Failed to update annotation task ${annotationTaskId} timestamp: ${taskUpdateError.message}`);
    }

    // Check if status is being changed to ANNOTATED or FLAGGED
    if (updates.status && (updates.status === 'ANNOTATED' || updates.status === 'FLAGGED')) {
      try {
        // Check if all annotations under this task are now completed (ANNOTATED or FLAGGED)
        const totalAnnotations = await Annotation.count({
          where: { annotationTaskId }
        });
        
        const completedAnnotations = await Annotation.count({
          where: { 
            annotationTaskId,
            status: ['ANNOTATED', 'FLAGGED']
          }
        });
        
        // If all annotations are completed, update the task status
        if (totalAnnotations === completedAnnotations) {
          // Get the annotation task (either from include or fetch it)
          let annotationTask = (annotation as any).annotationTask;
          if (!annotationTask) {
            annotationTask = await AnnotationTask.findByPk(annotationTaskId);
          }
          
          if (annotationTask && annotationTask.status !== 'COMPLETED') {
            await annotationTask.update({ status: 'COMPLETED' });
            request.log.info(`Annotation task ${annotationTaskId} marked as COMPLETED`);
          }
        }
      } catch (taskStatusError: any) {
        // Log the error but don't fail the annotation update
        request.log.warn(`Failed to update annotation task ${annotationTaskId} status: ${taskStatusError.message}`);
      }
    }

    return reply.send({
      message: 'Annotation updated successfully',
      annotation: formatAnnotationResponse(annotation)
    });

  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
