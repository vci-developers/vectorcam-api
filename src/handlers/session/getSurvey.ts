import { FastifyRequest, FastifyReply } from 'fastify';
import { findSessionById, handleError } from './common';
import { SurveillanceForm } from '../../db/models';

export const schema = {
  tags: ['Sessions'],
  description: 'Get session surveillance form',
  params: {
    type: 'object',
    properties: {
      session_id: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        formId: { type: 'number' },
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
};

export async function getSessionSurvey(
  request: FastifyRequest<{ Params: { session_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;

    const session = await findSessionById(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Get surveillance form for this session
    const surveillanceForm = await SurveillanceForm.findOne({
      where: { sessionId: session_id }
    });

    if (!surveillanceForm) {
      return reply.code(404).send({ error: 'Surveillance form not found for this session' });
    }

    reply.send({
      formId: surveillanceForm.id,
      sessionId: surveillanceForm.sessionId,
      numPeopleSleptInHouse: surveillanceForm.numPeopleSleptInHouse,
      wasIrsConducted: surveillanceForm.wasIrsConducted,
      monthsSinceIrs: surveillanceForm.monthsSinceIrs,
      numLlinsAvailable: surveillanceForm.numLlinsAvailable,
      llinType: surveillanceForm.llinType,
      llinBrand: surveillanceForm.llinBrand,
      numPeopleSleptUnderLlin: surveillanceForm.numPeopleSleptUnderLlin
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to get session surveillance form');
  }
} 