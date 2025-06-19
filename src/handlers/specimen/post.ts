import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findSessionById, 
  handleError, 
  formatSpecimenResponse,
} from './common';
import { InferenceResult, Specimen } from '../../db/models';

interface CreateSpecimenRequest {
  specimenId: string;
  sessionId: number;
  species?: string;
  sex?: string;
  abdomenStatus?: string;
  capturedAt?: number;
  inferenceResult?: {
    bboxTopLeftX: number;
    bboxTopLeftY: number;
    bboxWidth: number;
    bboxHeight: number;
    speciesProbabilities: number[];
    sexProbabilities: number[];
    abdomenStatusProbabilities: number[];
  };
}

export const schema = {
  tags: ['Specimens'],
  description: 'Create a new specimen',
  body: {
    type: 'object',
    required: ['sessionId', 'specimenId'],
    properties: {
      specimenId: { type: 'string' },
      sessionId: { type: 'number' },
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
          speciesProbabilities: { 
            type: 'array',
            items: { type: 'number' }
          },
          sexProbabilities: { 
            type: 'array',
            items: { type: 'number' }
          },
          abdomenStatusProbabilities: { 
            type: 'array',
            items: { type: 'number' }
          }
        }
      }
    }
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        specimen: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            specimenId: { type: 'string' },
            sessionId: { type: 'number' },
            imageUrl: { type: ['string', 'null'] },
            species: { type: ['string', 'null'] },
            sex: { type: ['string', 'null'] },
            abdomenStatus: { type: ['string', 'null'] },
            capturedAt: { type: ['number', 'null'] },
            inferenceResult: {
              type: ['object', 'null'],
              properties: {
                id: { type: 'number' },
                bboxTopLeftX: { type: 'number' },
                bboxTopLeftY: { type: 'number' },
                bboxWidth: { type: 'number' },
                bboxHeight: { type: 'number' },
                speciesProbabilities: { 
                  type: 'array',
                  items: { type: 'number' }
                },
                sexProbabilities: { 
                  type: 'array',
                  items: { type: 'number' }
                },
                abdomenStatusProbabilities: { 
                  type: 'array',
                  items: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }
};

export async function createSpecimen(
  request: FastifyRequest<{ Body: CreateSpecimenRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const {
      specimenId,
      sessionId,
      species,
      sex,
      abdomenStatus,
      capturedAt,
      inferenceResult,
    } = request.body;

    // Check if session exists
    const session = await findSessionById(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Create the specimen first
    const specimen = await Specimen.create({
      specimenId,
      sessionId,
      species,
      sex,
      abdomenStatus,
      capturedAt: capturedAt ? new Date(capturedAt) : null,
    });

    // Create inference result if provided
    if (inferenceResult) {
      await InferenceResult.create({
        specimenId: specimen.id,
        bboxTopLeftX: inferenceResult.bboxTopLeftX,
        bboxTopLeftY: inferenceResult.bboxTopLeftY,
        bboxWidth: inferenceResult.bboxWidth,
        bboxHeight: inferenceResult.bboxHeight,
        speciesProbabilities: JSON.stringify(inferenceResult.speciesProbabilities),
        sexProbabilities: JSON.stringify(inferenceResult.sexProbabilities),
        abdomenStatusProbabilities: JSON.stringify(inferenceResult.abdomenStatusProbabilities)
      });
    }

    const formattedResponse = await formatSpecimenResponse(specimen);

    return reply.code(201).send({
      message: 'Specimen created successfully',
      specimen: formattedResponse
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to create specimen');
  }
} 