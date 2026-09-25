import { FastifyRequest, FastifyReply } from 'fastify';
import { findSession, findSessionById, handleError } from '../common';
import { SurveillanceForm } from '../../../db/models';

interface UpdateSurveyRequest {
  numPeopleSleptInHouse?: number;
  wasIrsConducted?: boolean;
  monthsSinceIrs?: number;
  numLlinsAvailable?: number;
  llinType?: string;
  llinBrand?: string;
  numPeopleSleptUnderLlin?: number;
  numChildrenUnder5?: number;
  hasPregnantWoman?: boolean;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Update a surveillance form',
  params: {
    type: 'object',
    properties: {
      session_id: { type: 'string' }
    }
  },
  body: {
    type: 'object',
    properties: {
      numPeopleSleptInHouse: { type: 'number' },
      wasIrsConducted: { type: 'boolean' },
      monthsSinceIrs: { type: 'number' },
      numLlinsAvailable: { type: 'number' },
      llinType: { type: 'string' },
      llinBrand: { type: 'string' },
      numPeopleSleptUnderLlin: { type: 'number' },
      numChildrenUnder5: { type: 'number' },
      hasPregnantWoman: { type: 'boolean' }
    }
  },
  response: {
    200: {
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
            numChildrenUnder5: { type: ['number', 'null'] },
            hasPregnantWoman: { type: ['boolean', 'null'] },
            submittedAt: { type: 'number' },
          }
        }
      }
    }
  }
};

export async function updateSurvey(
  request: FastifyRequest<{ 
    Params: { session_id: string };
    Body: UpdateSurveyRequest;
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;
    const {
      numPeopleSleptInHouse,
      wasIrsConducted,
      monthsSinceIrs,
      numLlinsAvailable,
      llinType,
      llinBrand,
      numPeopleSleptUnderLlin,
      numChildrenUnder5,
      hasPregnantWoman
    } = request.body;

    // Check if session exists
    const session = await findSession(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Find the surveillance form
    const form = await SurveillanceForm.findOne({
      where: { sessionId: session.id }
    });

    if (!form) {
      return reply.code(404).send({ error: 'Surveillance form not found for this session' });
    }

    // Update the form
    await form.update({
      numPeopleSleptInHouse: numPeopleSleptInHouse !== undefined ? numPeopleSleptInHouse : form.numPeopleSleptInHouse,
      wasIrsConducted: wasIrsConducted !== undefined ? wasIrsConducted : form.wasIrsConducted,
      monthsSinceIrs: monthsSinceIrs !== undefined ? monthsSinceIrs : form.monthsSinceIrs,
      numLlinsAvailable: numLlinsAvailable !== undefined ? numLlinsAvailable : form.numLlinsAvailable,
      llinType: llinType !== undefined ? llinType : form.llinType,
      llinBrand: llinBrand !== undefined ? llinBrand : form.llinBrand,
      numPeopleSleptUnderLlin: numPeopleSleptUnderLlin !== undefined ? numPeopleSleptUnderLlin : form.numPeopleSleptUnderLlin,
      numChildrenUnder5: numChildrenUnder5 !== undefined ? numChildrenUnder5 : form.numChildrenUnder5,
      hasPregnantWoman: hasPregnantWoman !== undefined ? hasPregnantWoman : form.hasPregnantWoman
    });

    return reply.send({
      message: 'Surveillance form updated successfully',
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
        numPeopleSleptUnderLlin: form.numPeopleSleptUnderLlin,
        numChildrenUnder5: form.numChildrenUnder5,
        hasPregnantWoman: form.hasPregnantWoman
      }
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to update surveillance form');
  }
} 