import { FastifyRequest, FastifyReply } from 'fastify';
import { findSession, handleError } from '../common';
import { Specimen } from '../../../db/models';
import { formatSpecimenResponse } from '../../specimen/common';

export const schema = {
  tags: ['Sessions'],
  description: 'Get specimens for a session',
  params: {
    type: 'object',
    properties: {
      session_id: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        specimens: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              specimenId: { type: 'string' },
              thumbnailUrl: { type: ['string', 'null'] },
              thumbnailImageId: { type: ['number', 'null'] },
              shouldProcessFurther: { type: 'boolean' },
              totalImages: { type: 'number' },
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
  }
};

export async function getSessionSpecimens(
  request: FastifyRequest<{ Params: { session_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;

    const session = await findSession(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Get all specimens for this session
    const specimens = await Specimen.findAll({
      where: { sessionId: session_id },
      order: [['createdAt', 'DESC']],
    });

    // For each specimen, get only the thumbnail image and relevant fields
    const specimensWithThumbnail = await Promise.all(specimens.map(async specimen => {
      const formatted = await formatSpecimenResponse(specimen, false);
      // Only return the relevant fields (no images array)
      return {
        id: formatted.id,
        specimenId: formatted.specimenId,
        thumbnailUrl: formatted.thumbnailUrl,
        thumbnailImageId: formatted.thumbnailImageId,
        shouldProcessFurther: formatted.shouldProcessFurther,
        thumbnailImage: formatted.thumbnailImage
      };
    }));

    return reply.send({
      specimens: specimensWithThumbnail
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get session specimens');
  }
} 