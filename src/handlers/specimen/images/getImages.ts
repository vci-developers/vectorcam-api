import { FastifyRequest, FastifyReply } from 'fastify';
import { findSpecimen, handleError } from '../common';
import { SpecimenImage, InferenceResult } from '../../../db/models';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Get all specimen images',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
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
                      speciesProbabilities: { type: 'array', items: { type: 'number' } },
                      sexProbabilities: { type: 'array', items: { type: 'number' } },
                      abdomenStatusProbabilities: { type: 'array', items: { type: 'number' } }
                    }
                  }
                ]
              },
              filemd5: { type: 'string' }
            }
          }
        },
        thumbnailUrl: { type: ['string', 'null'] },
        thumbnailImageId: { type: ['number', 'null'] }
      }
    }
  }
};

export async function getImages(
  request: FastifyRequest<{ Params: { specimen_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;
    
    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Find all images for this specimen
    const images = await SpecimenImage.findAll({
      where: { specimenId: specimen.id },
      order: [['created_at', 'DESC']]
    });

    if (images.length === 0) {
      return reply.code(200).send({ 
        images: [],
        thumbnailUrl: null,
        thumbnailImageId: null
      });
    }

    // Format the response
    const formattedImages = await Promise.all(images.map(async (img) => {
      const inferenceResult = await InferenceResult.findOne({
        where: { specimenImageId: img.id }
      });
      return {
        id: img.id,
        url: `/specimens/${specimen.specimenId}/images/${img.id}`,
        species: img.species,
        sex: img.sex,
        abdomenStatus: img.abdomenStatus,
        capturedAt: img.capturedAt ? img.capturedAt.getTime() : null,
        submittedAt: img.createdAt.getTime(),
        inferenceResult: inferenceResult ? {
          id: inferenceResult.id,
          bboxTopLeftX: inferenceResult.bboxTopLeftX,
          bboxTopLeftY: inferenceResult.bboxTopLeftY,
          bboxWidth: inferenceResult.bboxWidth,
          bboxHeight: inferenceResult.bboxHeight,
          bboxConfidence: inferenceResult.bboxConfidence,
          bboxClassId: inferenceResult.bboxClassId,
          speciesProbabilities: JSON.parse(inferenceResult.speciesProbabilities),
          sexProbabilities: JSON.parse(inferenceResult.sexProbabilities),
          abdomenStatusProbabilities: JSON.parse(inferenceResult.abdomenStatusProbabilities)
        } : null,
        filemd5: img.filemd5
      };
    }));

    // Get the thumbnail URL
    let thumbnailUrl = null;
    if (specimen.thumbnailImageId) {
      const thumbnail = images.find(img => img.id === specimen.thumbnailImageId);
      if (thumbnail) {
        thumbnailUrl = `/specimens/${specimen.specimenId}/images/${thumbnail.id}`;
      }
    }

    return reply.code(200).send({
      images: formattedImages,
      thumbnailUrl,
      thumbnailImageId: specimen.thumbnailImageId
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 