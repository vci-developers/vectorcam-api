import { FastifyRequest, FastifyReply } from 'fastify';
import { findSessionById, handleError } from '../common';
import { SurveillanceForm } from '../../../db/models';

interface CreateSurveyRequest {
  sessionId: number;
  numPeopleSleptInHouse?: number;
  wasIrsConducted?: boolean;
  monthsSinceIrs?: number;
  numLlinsAvailable?: number;
  llinType?: string;
  llinBrand?: string;
  numPeopleSleptUnderLlin?: number;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Create a new surveillance form',
  body: {
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: { type: 'number' },
      numPeopleSleptInHouse: { type: 'number' },
      wasIrsConducted: { type: 'boolean' },
      monthsSinceIrs: { type: 'number' },
      numLlinsAvailable: { type: 'number' },
      llinType: { type: 'string' },
      llinBrand: { type: 'string' },
      numPeopleSleptUnderLlin: { type: 'number' }
    }
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        form: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            sessionId: { type: 'number' },
            numPeopleSleptInHouse: { type: ['number', 'null'] },
            wasIrsConducted: { type: ['boolean', 'null'] },
            monthsSinceIrs: { type: ['number', 'null'] },
            numLlinsAvailable: { type: ['number', 'null'] },
            llinType: { type: ['string', 'null'] },
            llinBrand: { type: ['string', 'null'] },
            numPeopleSleptUnderLlin: { type: ['number', 'null'] }
          }
        }
      }
    }
  }
};

export async function createSurvey(
  request: FastifyRequest<{ Body: CreateSurveyRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const {
      sessionId,
      numPeopleSleptInHouse,
      wasIrsConducted,
      monthsSinceIrs,
      numLlinsAvailable,
      llinType,
      llinBrand,
      numPeopleSleptUnderLlin
    } = request.body;

    // Check if session exists
    const session = await findSessionById(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Check if a survey already exists for this session
    const existingSurvey = await SurveillanceForm.findOne({
      where: { sessionId }
    });

    if (existingSurvey) {
      return reply.code(409).send({ error: 'A surveillance form already exists for this session' });
    }

    // Create the surveillance form
    const form = await SurveillanceForm.create({
      sessionId,
      numPeopleSleptInHouse,
      wasIrsConducted,
      monthsSinceIrs,
      numLlinsAvailable,
      llinType,
      llinBrand,
      numPeopleSleptUnderLlin
    });

    reply.code(201).send({
      message: 'Surveillance form created successfully',
      form
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to create surveillance form');
  }
} 