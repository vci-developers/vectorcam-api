import { FastifyRequest, FastifyReply } from 'fastify';
import { findSessionById, handleError } from '../common';
import { SurveillanceForm } from '../../../db/models';

interface UpdateSurveyRequest {
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
  description: 'Update a surveillance form',
  params: {
    type: 'object',
    properties: {
      session_id: { type: 'number' }
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
      numPeopleSleptUnderLlin: { type: 'number' }
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
            numPeopleSleptUnderLlin: { type: ['number', 'null'] }
          }
        }
      }
    }
  }
};

export async function updateSurvey(
  request: FastifyRequest<{ 
    Params: { session_id: number };
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
      numPeopleSleptUnderLlin
    } = request.body;

    // Check if session exists
    const session = await findSessionById(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Find the surveillance form
    const form = await SurveillanceForm.findOne({
      where: { sessionId: session_id }
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
      numPeopleSleptUnderLlin: numPeopleSleptUnderLlin !== undefined ? numPeopleSleptUnderLlin : form.numPeopleSleptUnderLlin
    });

    return reply.send({
      message: 'Surveillance form updated successfully',
      form
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to update surveillance form');
  }
} 