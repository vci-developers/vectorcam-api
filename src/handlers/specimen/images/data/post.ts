import { FastifyRequest, FastifyReply } from 'fastify';
import { SpecimenImage, InferenceResult, Specimen } from '../../../../db/models';
import { handleError } from '../../common';

interface CreateImageDataRequestBody {
  species?: string;
  sex?: string;
  abdomenStatus?: string;
  capturedAt?: number;
  filemd5: string;
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
  };
}

export const schema = {
  tags: ['Specimen Images'],
  description: 'Create a specimen image data record',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'number' }
    },
    required: ['specimen_id']
  },
  body: {
    type: 'object',
    properties: {
      species: { type: 'string' },
      sex: { type: 'string' },
      abdomenStatus: { type: 'string' },
      capturedAt: { type: 'number' },
      filemd5: { type: 'string' },
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
          abdomenStatusLogits: { type: 'array', items: { type: 'number' } }
        },
        required: ['bboxTopLeftX', 'bboxTopLeftY', 'bboxWidth', 'bboxHeight', 'speciesLogits', 'sexLogits', 'abdomenStatusLogits']
      }
    },
    required: ['filemd5']
  },
  response: {
    201: {
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
            filemd5: { type: 'string' },
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
                    abdomenStatusLogits: { type: 'array', items: { type: 'number' } }
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

export async function createImageData(
  request: FastifyRequest<{ Params: { specimen_id: number }; Body: CreateImageDataRequestBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;
    const { species, sex, abdomenStatus, capturedAt, filemd5, inferenceResult } = request.body;

    // Find the specimen
    const specimen = await Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Check for uniqueness of filemd5 under the same specimen
    const existingImage = await SpecimenImage.findOne({ where: { filemd5, specimenId: specimen.id } });
    if (existingImage) {
      return reply.code(409).send({ error: 'A specimen image with this filemd5 already exists for this specimen' });
    }

    // Create the SpecimenImage record
    const newImage = await SpecimenImage.create({
      specimenId: specimen.id,
      species,
      sex,
      abdomenStatus,
      capturedAt: capturedAt ? new Date(capturedAt) : null,
      imageKey: '', // Placeholder, as imageKey is required in the model but not provided here
      filemd5 // Now required
    });

    let createdInferenceResult = null;
    if (inferenceResult) {
      createdInferenceResult = await InferenceResult.create({
        specimenImageId: newImage.id,
        bboxTopLeftX: inferenceResult.bboxTopLeftX,
        bboxTopLeftY: inferenceResult.bboxTopLeftY,
        bboxWidth: inferenceResult.bboxWidth,
        bboxHeight: inferenceResult.bboxHeight,
        bboxConfidence: inferenceResult.bboxConfidence,
        bboxClassId: inferenceResult.bboxClassId,
        speciesLogits: JSON.stringify(inferenceResult.speciesLogits),
        sexLogits: JSON.stringify(inferenceResult.sexLogits),
        abdomenStatusLogits: JSON.stringify(inferenceResult.abdomenStatusLogits)
      });
    }

    // Build the response object
    const responseImage = {
      id: newImage.id,
      url: `/specimens/${specimen.id}/images/${newImage.id}`,
      species: newImage.species,
      sex: newImage.sex,
      abdomenStatus: newImage.abdomenStatus,
      capturedAt: newImage.capturedAt ? newImage.capturedAt.getTime() : null,
      submittedAt: newImage.createdAt.getTime(),
      filemd5: newImage.filemd5,
      inferenceResult: createdInferenceResult
        ? {
            id: createdInferenceResult.id,
            bboxTopLeftX: createdInferenceResult.bboxTopLeftX,
            bboxTopLeftY: createdInferenceResult.bboxTopLeftY,
            bboxWidth: createdInferenceResult.bboxWidth,
            bboxHeight: createdInferenceResult.bboxHeight,
            bboxConfidence: createdInferenceResult.bboxConfidence,
            bboxClassId: createdInferenceResult.bboxClassId,
            speciesLogits: JSON.parse(createdInferenceResult.speciesLogits),
            sexLogits: JSON.parse(createdInferenceResult.sexLogits),
            abdomenStatusLogits: JSON.parse(createdInferenceResult.abdomenStatusLogits)
          }
        : null
    };

    return reply.code(201).send({ message: 'Image created successfully', image: responseImage });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to create specimen image');
  }
} 