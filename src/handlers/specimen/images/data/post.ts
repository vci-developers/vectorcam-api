import { FastifyRequest, FastifyReply } from 'fastify';
import { SpecimenImage, InferenceResult, Specimen } from '../../../../db/models';
import {
  handleError,
  formatImageResponse,
  enrichSpecimenImageInferenceData,
  specimenImagePredictionCreateFields,
  specimenImagePredictionSchemaProperties,
  specimenImageInferenceResponseSchemaProperties,
} from '../../common';

interface CreateImageDataRequestBody {
  metadata?: Record<string, unknown> | null;
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
    speciesLogits?: number[];
    sexLogits?: number[];
    abdomenStatusLogits?: number[];
    speciesInferenceDuration?: number;
    sexInferenceDuration?: number;
    abdomenStatusInferenceDuration?: number;
    bboxDetectionDuration?: number;
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
      metadata: { type: ['object', 'null'], additionalProperties: true },
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
          abdomenStatusLogits: { type: 'array', items: { type: 'number' } },
          speciesInferenceDuration: { type: 'number' },
          sexInferenceDuration: { type: 'number' },
          abdomenStatusInferenceDuration: { type: 'number' },
          bboxDetectionDuration: { type: 'number' }
        },
        required: ['bboxTopLeftX', 'bboxTopLeftY', 'bboxWidth', 'bboxHeight']
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
            metadata: { type: ['object', 'null'], additionalProperties: true },
            ...specimenImagePredictionSchemaProperties,
            capturedAt: { type: ['number', 'null'] },
            submittedAt: { type: 'number' },
            filemd5: { type: 'string' },
            ...specimenImageInferenceResponseSchemaProperties,
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
    const { metadata, species, sex, abdomenStatus, capturedAt, filemd5, inferenceResult } = request.body;

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
      metadata: metadata ?? null,
      ...specimenImagePredictionCreateFields({ species, sex, abdomenStatus }),
      capturedAt: capturedAt ? new Date(capturedAt) : null,
      imageKey: '', // Placeholder, as imageKey is required in the model but not provided here
      filemd5 // Now required
    });

    let createdInferenceResult: InferenceResult | null = null;
    if (inferenceResult) {
      createdInferenceResult = await InferenceResult.create({
        specimenImageId: newImage.id,
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

    (newImage as SpecimenImage & { inferenceResult?: InferenceResult | null }).inferenceResult =
      createdInferenceResult;
    await enrichSpecimenImageInferenceData(newImage);
    return reply.code(201).send({
      message: 'Image created successfully',
      image: {
        ...formatImageResponse(specimen.id, newImage),
        filemd5: newImage.filemd5,
      },
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to create specimen image');
  }
} 