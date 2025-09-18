import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  Annotation, 
  AnnotationTask, 
  User, 
  Specimen, 
  SpecimenImage, 
  InferenceResult, 
  Session, 
  Site 
} from '../../db/models';
import { formatAnnotationResponse } from './common';

interface GetAnnotationParams {
  annotationId: number;
}

interface GetAnnotationRequest extends FastifyRequest {
  params: GetAnnotationParams;
}

export const schema = {
  tags: ['Annotations'],
  summary: 'Get annotation details',
  description: 'Get detailed annotation information with related data (requires admin token or superadmin user access)',
  params: {
    type: 'object',
    required: ['annotationId'],
    properties: {
      annotationId: { type: 'number' }
    }
  },
  response: {
    200: {
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
        updatedAt: { type: 'number' },
        annotationTask: {
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
        },
        annotator: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' }
          }
        },
        specimen: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            specimenId: { type: 'string' },
            sessionId: { type: 'number' },
            thumbnailUrl: { type: ['string', 'null'] },
            thumbnailImageId: { type: ['number', 'null'] },
            images: { type: 'array' },
            thumbnailImage: {
              type: ['object', 'null'],
              properties: {
                id: { type: 'number' },
                url: { type: 'string' },
                species: { type: ['string', 'null'] },
                sex: { type: ['string', 'null'] },
                abdomenStatus: { type: ['string', 'null'] },
                capturedAt: { type: ['number', 'null'] },
                submittedAt: { type: 'number' },
                inferenceResult: {
                  type: ['object', 'null'],
                  properties: {
                    id: { type: 'number' },
                    bboxTopLeftX: { type: 'number' },
                    bboxTopLeftY: { type: 'number' },
                    bboxWidth: { type: 'number' },
                    bboxHeight: { type: 'number' },
                    bboxConfidence: { type: 'number' },
                    bboxClassId: { type: 'number' },
                    speciesLogits: { type: 'array' },
                    sexLogits: { type: 'array' },
                    abdomenStatusLogits: { type: 'array' },
                    speciesInferenceDuration: { type: ['number', 'null'] },
                    sexInferenceDuration: { type: ['number', 'null'] },
                    abdomenStatusInferenceDuration: { type: ['number', 'null'] },
                    bboxDetectionDuration: { type: ['number', 'null'] }
                  }
                }
              }
            },
            session: {
              type: 'object',
              properties: {
                sessionId: { type: 'number' },
                frontendId: { type: 'string' },
                collectorTitle: { type: ['string', 'null'] },
                collectorName: { type: ['string', 'null'] },
                collectionDate: { type: ['number', 'null'] },
                collectionMethod: { type: ['string', 'null'] },
                specimenCondition: { type: ['string', 'null'] },
                createdAt: { type: ['number', 'null'] },
                completedAt: { type: ['number', 'null'] },
                submittedAt: { type: 'number' },
                notes: { type: ['string', 'null'] },
                siteId: { type: 'number' },
                deviceId: { type: 'number' },
                latitude: { type: ['number', 'null'] },
                longitude: { type: ['number', 'null'] },
                type: { type: 'string' },
                site: {
                  type: 'object',
                  properties: {
                    siteId: { type: 'number' },
                    programId: { type: 'number' },
                    district: { type: ['string', 'null'] },
                    subCounty: { type: ['string', 'null'] },
                    parish: { type: ['string', 'null'] },
                    villageName: { type: ['string', 'null'] },
                    houseNumber: { type: 'string' },
                    isActive: { type: 'boolean' },
                    healthCenter: { type: ['string', 'null'] }
                  }
                }
              }
            }
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

export default async function getAnnotation(
  request: GetAnnotationRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { annotationId } = request.params;

    // First check if user has access to this annotation
    if (!request.isAdminToken && request.user) {
      // For superadmin users, check if the annotation belongs to one of their tasks
      const annotation = await Annotation.findByPk(annotationId, {
        include: [{
          model: AnnotationTask,
          as: 'annotationTask',
          where: { userId: request.user.id },
          attributes: ['id']
        }]
      });
      
      if (!annotation) {
        return reply.code(404).send({ error: 'Annotation not found or access denied' });
      }
    }

    // Fetch annotation with all related data
    const annotation = await Annotation.findByPk(annotationId, {
      include: [
        {
          model: AnnotationTask,
          as: 'annotationTask'
        },
        {
          model: User,
          as: 'annotator'
        },
        {
          model: Specimen,
          as: 'specimen',
          include: [
            {
              model: SpecimenImage,
              as: 'thumbnailImage',
              include: [
                {
                  model: InferenceResult,
                  as: 'inferenceResult',
                }
              ]
            },
            {
              model: Session,
              as: 'session',
              include: [
                {
                  model: Site,
                  as: 'site'
                }
              ]
            }
          ]
        }
      ]
    });

    if (!annotation) {
      return reply.code(404).send({ error: 'Annotation not found' });
    }

    return reply.send(formatAnnotationResponse(annotation, true));

  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
