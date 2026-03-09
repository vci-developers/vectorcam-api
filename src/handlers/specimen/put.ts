import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { formatSpecimenResponse, handleError } from './common';
import { Specimen, SpecimenImage, Session } from '../../db/models';
import { getChangedFields, logReviewAction } from '../../services/reviewActionLog.service';

interface UpdateSpecimenRequest {
  specimenId?: string;
  thumbnailImageId?: number;
  shouldProcessFurther?: boolean;
  expectedImages?: number;
}

export const schema = {
  tags: ['Specimens'],
  description: 'Update specimen details',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'number' }
    }
  },
  body: {
    type: 'object',
    properties: {
      specimenId: { type: 'string' },
      thumbnailImageId: { type: 'number' },
      shouldProcessFurther: { type: 'boolean' },
      expectedImages: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        specimen: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            specimenId: { type: 'string' },
            sessionId: { type: 'number' },
            thumbnailUrl: { type: ['string', 'null'] },
            thumbnailImageId: { type: ['number', 'null'] },
            shouldProcessFurther: { type: 'boolean' },
            expectedImages: { type: 'number' },
            thumbnailImage: {
              anyOf: [
                { type: 'null' },
                {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    url: { type: 'string' },
                    species: { type: ['string', 'null'] },
                    sex: { type: ['string', 'null'] },
                    abdomenStatus: { type: ['string', 'null'] },
                    capturedAt: { type: ['number', 'null'] },
                    submittedAt: { type: 'number' },
                    inferenceResult: {
                      anyOf: [
                        { type: 'null' },
                        {
                          type: 'object',
                          properties: {
                            id: { type: 'number' },
                            bboxTopLeftX: { type: 'number' },
                            bboxTopLeftY: { type: 'number' },
                            bboxWidth: { type: 'number' },
                            bboxHeight: { type: 'number' },
                            bboxConfidence: { type: 'number' },
                            bboxClassId: { type: 'number' },
                            speciesLogits: { type: 'array', items: { type: 'number' } },
                            sexLogits: { type: 'array', items: { type: 'number' } },
                            abdomenStatusLogits: { type: 'array', items: { type: 'number' } },
                            speciesInferenceDuration: { type: ['number', 'null'] },
                            sexInferenceDuration: { type: ['number', 'null'] },
                            abdomenStatusInferenceDuration: { type: ['number', 'null'] },
                            bboxDetectionDuration: { type: ['number', 'null'] }
                          }
                        }
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }
  }
};

export async function updateSpecimen(
  request: FastifyRequest<{ Params: { specimen_id: number }; Body: UpdateSpecimenRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;
    const { specimenId, thumbnailImageId, shouldProcessFurther, expectedImages } = request.body;
    
    const specimen = await Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // If changing specimenId, check if new id already exists
    if (specimenId && specimenId !== specimen.specimenId) {
      const idExists = await Specimen.findOne({
        where: { 
          specimenId,
          id: { [Op.ne]: specimen.id }
        }
      });
      if (idExists) {
        return reply.code(409).send({ error: 'A specimen with this id already exists' });
      }
    }

    // Check if thumbnailImageId is valid
    if (thumbnailImageId !== undefined) {
      const imageExists = await SpecimenImage.findOne({
        where: {
          id: thumbnailImageId,
          specimenId: specimen.id
        }
      });
      if (!imageExists) {
        return reply.code(400).send({ error: 'The specified image does not exist or does not belong to this specimen' });
      }
    }

    const trackedFields = ['specimenId', 'thumbnailImageId', 'shouldProcessFurther', 'expectedImages'];
    const beforeState: Record<string, unknown> = {
      specimenId: specimen.specimenId,
      thumbnailImageId: specimen.thumbnailImageId,
      shouldProcessFurther: specimen.shouldProcessFurther,
      expectedImages: specimen.expectedImages,
    };

    // Update the specimen with the new data
    await specimen.update({
      specimenId: specimenId !== undefined ? specimenId : specimen.specimenId,
      thumbnailImageId: thumbnailImageId !== undefined ? thumbnailImageId : specimen.thumbnailImageId,
      shouldProcessFurther: shouldProcessFurther !== undefined ? shouldProcessFurther : specimen.shouldProcessFurther,
      expectedImages: expectedImages !== undefined ? expectedImages : specimen.expectedImages
    });

    const afterState: Record<string, unknown> = {
      specimenId: specimen.specimenId,
      thumbnailImageId: specimen.thumbnailImageId,
      shouldProcessFurther: specimen.shouldProcessFurther,
      expectedImages: specimen.expectedImages,
    };
    const changedFields = getChangedFields(beforeState, afterState, trackedFields);
    const session = await Session.findByPk(specimen.sessionId);
    if (session) {
      const reviewDate = session.collectionDate || session.createdAt || new Date();
      const userId = (request as any).user?.id || null;

      try {
        await logReviewAction({
          siteId: session.siteId,
          year: reviewDate.getFullYear(),
          month: reviewDate.getMonth() + 1,
          action: 'update_specimen_thumbnail_prediction',
          userId,
          changes: changedFields,
          fields: {
            endpoint: '/specimens/:specimen_id',
            httpMethod: 'PUT',
            entityType: 'specimen',
            entityId: specimen.id,
            sessionId: session.id,
            specimenId: specimen.id,
          },
          metadata: {
            bodyKeys: Object.keys(request.body || {}),
          },
        });
      } catch (logError) {
        request.log.error({ err: logError, specimenId: specimen.id }, 'Failed to write review action log');
      }
    }

    // Get the updated specimen
    const updatedSpecimen = await specimen.reload();
    if (!updatedSpecimen) {
      return reply.code(500).send({ error: 'Failed to update specimen' });
    }

    const response = await formatSpecimenResponse(updatedSpecimen, false);
    return reply.send({
      message: 'Specimen updated successfully',
      specimen: response
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to update specimen');
  }
} 