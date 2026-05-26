import { FastifyRequest, FastifyReply } from 'fastify';
import { Specimen } from '../../../db/models';
import { formatSpecimenResponse, handleError, validateSpecimenSessionUnit } from '../../specimen/common';
import { findSession } from '../common';

export const schema = {
  tags: ['Sessions'],
  description: 'Create a new specimen for a session',
  params: {
    type: 'object',
    required: ['session_id'],
    properties: {
      session_id: { type: 'string' }
    }
  },
  body: {
    type: 'object',
    required: ['specimenId'],
    properties: {
      specimenId: { type: 'string' },
      sessionUnitId: { type: ['number', 'null'] },
      shouldProcessFurther: { type: 'boolean' },
      expectedImages: { type: 'number' }
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
            sessionUnitId: { type: ['number', 'null'] },
            sessionUnit: {
              anyOf: [
                { type: 'null' },
                {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    frontendId: { type: ['string', 'null'] },
                    sessionId: { type: 'number' },
                    unitOrder: { type: 'number' },
                    createdAt: { type: ['number', 'null'] },
                    updatedAt: { type: ['number', 'null'] },
                  },
                },
              ],
            },
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
                    metadata: { type: ['object', 'null'], additionalProperties: true },
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

export async function createSessionSpecimen(
  request: FastifyRequest<{ Params: { session_id: string }; Body: { specimenId: string; sessionUnitId?: number | null; shouldProcessFurther?: boolean; expectedImages?: number } }>,
  reply: FastifyReply
) {
  const { session_id } = request.params;
  const { specimenId, sessionUnitId, shouldProcessFurther, expectedImages } = request.body;
  try {
    // Check if session exists
    const session = await findSession(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    // Check if specimen already exists for this session
    const existing = await Specimen.findOne({ where: { sessionId: session.id, specimenId } });
    if (existing) {
      return reply.code(409).send({ error: 'A specimen with this id already exists for this session' });
    }
    const unitError = await validateSpecimenSessionUnit(session, sessionUnitId);
    if (unitError) {
      return reply.code(400).send({ error: unitError });
    }
    const specimen = await Specimen.create({ 
      sessionId: session.id,
      sessionUnitId: sessionUnitId ?? null,
      specimenId,
      shouldProcessFurther: shouldProcessFurther ?? false,
      expectedImages,
    });
    const formatted = await formatSpecimenResponse(specimen, false);
    return reply.code(201).send({ message: 'Specimen created successfully', specimen: formatted });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to create specimen');
  }
} 