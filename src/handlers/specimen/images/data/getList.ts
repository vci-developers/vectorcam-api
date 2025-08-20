import { FastifyRequest, FastifyReply } from 'fastify';
import SpecimenImage from '../../../../db/models/SpecimenImage';
import { InferenceResult, Specimen } from '../../../../db/models';
import { parseProbabilityString } from '../../common';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Get all specimen images',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'number' }
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

export async function getImageList(
  request: FastifyRequest<{ Params: { specimen_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;
    
    const specimen = await Specimen.findByPk(specimen_id);
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
        url: `/specimens/${specimen.id}/images/${img.id}`,
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
          speciesLogits: parseProbabilityString(inferenceResult.speciesLogits),
          sexLogits: parseProbabilityString(inferenceResult.sexLogits),
          abdomenStatusLogits: parseProbabilityString(inferenceResult.abdomenStatusLogits),
          speciesInferenceDuration: inferenceResult.speciesInferenceDuration,
          sexInferenceDuration: inferenceResult.sexInferenceDuration,
          abdomenStatusInferenceDuration: inferenceResult.abdomenStatusInferenceDuration,
          bboxDetectionDuration: inferenceResult.bboxDetectionDuration
        } : null,
        filemd5: img.filemd5
      };
    }));

    // Get the thumbnail URL
    let thumbnailUrl = null;
    if (specimen.thumbnailImageId) {
      const thumbnail = images.find(img => img.id === specimen.thumbnailImageId);
      if (thumbnail) {
        thumbnailUrl = `/specimens/${specimen.id}/images/${thumbnail.id}`;
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