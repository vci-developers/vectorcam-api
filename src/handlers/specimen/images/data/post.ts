import { FastifyRequest, FastifyReply } from 'fastify';
import { SpecimenImage, InferenceResult } from '../../../../db/models';
import { findSpecimen, handleError } from '../../common';

interface CreateImageDataRequestBody {
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
  };
}

export const schema = {
  tags: ['Specimen Images'],
  description: 'Create a specimen image data record',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' }
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
    }
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
  request: FastifyRequest<{ Params: { specimen_id: string }; Body: CreateImageDataRequestBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;
    const { species, sex, abdomenStatus, capturedAt, inferenceResult } = request.body;

    // Find the specimen
    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Create the SpecimenImage record
    const newImage = await SpecimenImage.create({
      specimenId: specimen.id,
      species,
      sex,
      abdomenStatus,
      capturedAt: capturedAt ? new Date(capturedAt) : null,
      imageKey: '', // Placeholder, as imageKey is required in the model but not provided here
      filemd5: '' // Placeholder, as filemd5 is required in the model but not provided here
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
      url: `/specimens/${specimen.specimenId || specimen.id}/images/${newImage.id}`,
      species: newImage.species,
      sex: newImage.sex,
      abdomenStatus: newImage.abdomenStatus,
      capturedAt: newImage.capturedAt ? newImage.capturedAt.getTime() : null,
      submittedAt: newImage.createdAt.getTime(),
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