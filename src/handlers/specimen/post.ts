import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findSessionById, 
  handleError, 
  formatSpecimenResponse,
} from './common';
import { Specimen } from '../../db/models';
import { findSessionSpecimen } from '../session/common';

interface CreateSpecimenRequest {
  specimenId: string;
  sessionId: number;
}

export const schema = {
  tags: ['Specimens'],
  description: 'Create a new specimen',
  body: {
    type: 'object',
    required: ['sessionId', 'specimenId'],
    properties: {
      specimenId: { type: 'string' },
      sessionId: { type: 'number' }
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
            thumbnailUrl: { type: ['string', 'null'] },
            thumbnailImageId: { type: ['number', 'null'] },
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
                            abdomenStatusLogits: { type: 'array', items: { type: 'number' } }
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

export async function createSpecimen(
  request: FastifyRequest<{ Body: CreateSpecimenRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const {
      specimenId,
      sessionId,
    } = request.body;

    // Check if session exists
    const session = await findSessionById(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Check if specimenId is unique
    const existingSpecimen = await findSessionSpecimen(session.id, specimenId);
    if (existingSpecimen) {
      return reply.code(409).send({ error: 'A specimen with this id already exists' });
    }

    // Create the specimen first
    const specimen = await Specimen.create({
      specimenId,
      sessionId,
    });

    const formattedResponse = await formatSpecimenResponse(specimen, false);

    return reply.code(201).send({
      message: 'Specimen created successfully',
      specimen: formattedResponse
    });
  } catch (error: any) {
    // Handle unique constraint error from DB
    if (error.name === 'SequelizeUniqueConstraintError') {
      return reply.code(409).send({ error: 'A specimen with this id already exists' });
    }
    return handleError(error, request, reply, 'Failed to create specimen');
  }
} 