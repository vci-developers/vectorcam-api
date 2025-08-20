import { FastifyRequest, FastifyReply } from 'fastify';
import { SpecimenImage, InferenceResult, Specimen } from '../../../../db/models';
import { handleError, findSpecimenImage, parseProbabilityString } from '../../common';

interface UpdateImageDataRequestBody {
  species?: string;
  sex?: string;
  abdomenStatus?: string;
  capturedAt?: number;
  inferenceResult?: {
    bboxTopLeftX: number;
    bboxTopLeftY: number;
    bboxWidth: number;
    bboxHeight: number;
    bboxConfidence?: number;
    bboxClassId?: number;
    speciesLogits: number[];
    sexLogits: number[];
    abdomenStatusLogits: number[];
    speciesInferenceDuration?: number;
    sexInferenceDuration?: number;
    abdomenStatusInferenceDuration?: number;
    bboxDetectionDuration?: number;
  };
}

export const schema = {
  tags: ['Specimen Images'],
  description: 'Update a specimen image metadata',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'number' },
      image_id: { type: 'string' }
    },
    required: ['specimen_id', 'image_id']
  },
  body: {
    type: 'object',
    properties: {
      species: { type: 'string' },
      sex: { type: 'string' },
      abdomenStatus: { type: 'string' },
      capturedAt: { type: 'number' },
      inferenceResult: {
        type: 'object',
        properties: {
          bboxTopLeftX: { type: 'number' },
          bboxTopLeftY: { type: 'number' },
          bboxWidth: { type: 'number' },
          bboxHeight: { type: 'number' },
          bboxConfidence: { type: 'number' },
          bboxClassId: { type: 'number' },
          speciesLogits: { type: 'array', items: { type: 'number' } },
          sexLogits: { type: 'array', items: { type: 'number' } },
          abdomenStatusLogits: { type: 'array', items: { type: 'number' } },
          speciesInferenceDuration: { type: 'number' },
          sexInferenceDuration: { type: 'number' },
          abdomenStatusInferenceDuration: { type: 'number' },
          bboxDetectionDuration: { type: 'number' }
        }
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        image: {
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
      }
    }
  }
};

export async function updateImageData(
  request: FastifyRequest<{ Params: { specimen_id: number; image_id: number }; Body: UpdateImageDataRequestBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id, image_id } = request.params;
    const { species, sex, abdomenStatus, capturedAt, inferenceResult } = request.body;

    // Find the specimen
    const specimen = await Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Find the image
    const image = await findSpecimenImage(specimen.id, image_id);
    if (!image) {
      return reply.code(404).send({ error: 'Image not found' });
    }

    // Update image metadata
    await image.update({
      species,
      sex,
      abdomenStatus,
      capturedAt: capturedAt ? new Date(capturedAt) : null
    });

    // Update or create inference result
    let result = null;
    if (inferenceResult) {
      result = await InferenceResult.findOne({ where: { specimenImageId: image.id } });
      if (result) {
        await result.update({
          bboxTopLeftX: inferenceResult.bboxTopLeftX,
          bboxTopLeftY: inferenceResult.bboxTopLeftY,
          bboxWidth: inferenceResult.bboxWidth,
          bboxHeight: inferenceResult.bboxHeight,
          bboxConfidence: inferenceResult.bboxConfidence,
          bboxClassId: inferenceResult.bboxClassId,
          speciesLogits: inferenceResult.speciesLogits ? JSON.stringify(inferenceResult.speciesLogits) : null,
          sexLogits: inferenceResult.sexLogits ? JSON.stringify(inferenceResult.sexLogits) : null,
          abdomenStatusLogits: inferenceResult.abdomenStatusLogits ? JSON.stringify(inferenceResult.abdomenStatusLogits) : null,
          speciesInferenceDuration: inferenceResult.speciesInferenceDuration,
          sexInferenceDuration: inferenceResult.sexInferenceDuration,
          abdomenStatusInferenceDuration: inferenceResult.abdomenStatusInferenceDuration,
          bboxDetectionDuration: inferenceResult.bboxDetectionDuration
        });
      } else {
        result = await InferenceResult.create({
          specimenImageId: image.id,
          bboxTopLeftX: inferenceResult.bboxTopLeftX,
          bboxTopLeftY: inferenceResult.bboxTopLeftY,
          bboxWidth: inferenceResult.bboxWidth,
          bboxHeight: inferenceResult.bboxHeight,
          bboxConfidence: inferenceResult.bboxConfidence,
          bboxClassId: inferenceResult.bboxClassId,
          speciesLogits: inferenceResult.speciesLogits ? JSON.stringify(inferenceResult.speciesLogits) : null,
          sexLogits: inferenceResult.sexLogits ? JSON.stringify(inferenceResult.sexLogits) : null,
          abdomenStatusLogits: inferenceResult.abdomenStatusLogits ? JSON.stringify(inferenceResult.abdomenStatusLogits) : null,
          speciesInferenceDuration: inferenceResult.speciesInferenceDuration,
          sexInferenceDuration: inferenceResult.sexInferenceDuration,
          abdomenStatusInferenceDuration: inferenceResult.abdomenStatusInferenceDuration,
          bboxDetectionDuration: inferenceResult.bboxDetectionDuration
        });
      }
    } else {
      result = await InferenceResult.findOne({ where: { specimenImageId: image.id } });
    }

    // Build the updated image object for response
    const updatedImage = {
      id: image.id,
      url: `/specimens/${specimen.id}/images/${image.id}`,
      species: image.species,
      sex: image.sex,
      abdomenStatus: image.abdomenStatus,
      capturedAt: image.capturedAt ? image.capturedAt.getTime() : null,
      submittedAt: image.createdAt.getTime(),
      inferenceResult: result ? {
        id: result.id,
        bboxTopLeftX: result.bboxTopLeftX,
        bboxTopLeftY: result.bboxTopLeftY,
        bboxWidth: result.bboxWidth,
        bboxHeight: result.bboxHeight,
        bboxConfidence: result.bboxConfidence,
        bboxClassId: result.bboxClassId,
        speciesLogits: parseProbabilityString(result.speciesLogits),
        sexLogits: parseProbabilityString(result.sexLogits),
        abdomenStatusLogits: parseProbabilityString(result.abdomenStatusLogits),
        speciesInferenceDuration: result.speciesInferenceDuration,
        sexInferenceDuration: result.sexInferenceDuration,
        abdomenStatusInferenceDuration: result.abdomenStatusInferenceDuration,
        bboxDetectionDuration: result.bboxDetectionDuration
      } : null,
      filemd5: image.filemd5
    };

    return reply.send({ message: 'Image updated successfully', image: updatedImage });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to update specimen image');
  }
} 