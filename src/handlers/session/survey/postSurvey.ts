import { FastifyRequest, FastifyReply } from 'fastify';
import { findSession, handleError } from '../common';
import { SurveillanceForm } from '../../../db/models';

interface CreateSurveyRequest {
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
    properties: {
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
            numPeopleSleptUnderLlin: { type: ['number', 'null'] },
            submittedAt: { type: 'number' },
          }
        }
      }
    }
  }
};

export async function createSurvey(
  request: FastifyRequest<{ Params: { session_id: string }, Body: CreateSurveyRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const {
      numPeopleSleptInHouse,
      wasIrsConducted,
      monthsSinceIrs,
      numLlinsAvailable,
      llinType,
      llinBrand,
      numPeopleSleptUnderLlin
    } = request.body;

    const { session_id } = request.params;
    // Check if session exists
    const session = await findSession(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Check if a survey already exists for this session
    const existingSurvey = await SurveillanceForm.findOne({
      where: { sessionId: session.id }
    });

    if (existingSurvey) {
      return reply.code(409).send({ error: 'A surveillance form already exists for this session' });
    }

    // Create the surveillance form
    const form = await SurveillanceForm.create({
      sessionId: session.id,
      numPeopleSleptInHouse,
      wasIrsConducted,
      monthsSinceIrs,
      numLlinsAvailable,
      llinType,
      llinBrand,
      numPeopleSleptUnderLlin
    });

    return reply.code(201).send({
      message: 'Surveillance form created successfully',
      form: {
        formId: form.id,
        sessionId: form.sessionId,
        submittedAt: form.createdAt.getTime(),
        numPeopleSleptInHouse: form.numPeopleSleptInHouse,
        wasIrsConducted: form.wasIrsConducted,
        monthsSinceIrs: form.monthsSinceIrs,
        numLlinsAvailable: form.numLlinsAvailable,
        llinType: form.llinType,
        llinBrand: form.llinBrand,
        numPeopleSleptUnderLlin: form.numPeopleSleptUnderLlin
      }
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to create surveillance form');
  }
} 