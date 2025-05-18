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
        collectionDate: { type: ['string', 'null'], format: 'date' },
        officerName: { type: ['string', 'null'] },
        officerTitle: { type: ['string', 'null'] },
        peopleInHouse: { type: ['number', 'null'] },
        isBednetAvailable: { type: ['boolean', 'null'] },
        numberOfBednetsAvailable: { type: ['number', 'null'] },
        numberOfPeopleSleptUnderBednet: { type: ['number', 'null'] },
        bednetType: { type: ['string', 'null'] },
        bednetBrand: { type: ['string', 'null'] },
        isIrsSprayed: { type: ['boolean', 'null'] },
        irsDate: { type: ['string', 'null'], format: 'date' }
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
      collectionDate: surveillanceForm.collectionDate?.toISOString().split('T')[0] || null,
      officerName: surveillanceForm.officerName,
      officerTitle: surveillanceForm.officerTitle,
      peopleInHouse: surveillanceForm.peopleInHouse,
      isBednetAvailable: surveillanceForm.isBednetAvailable,
      numberOfBednetsAvailable: surveillanceForm.numberOfBednetsAvailable,
      numberOfPeopleSleptUnderBednet: surveillanceForm.numberOfPeopleSleptUnderBednet,
      bednetType: surveillanceForm.bednetType,
      bednetBrand: surveillanceForm.bednetBrand,
      isIrsSprayed: surveillanceForm.isIrsSprayed,
      irsDate: surveillanceForm.irsDate?.toISOString().split('T')[0] || null
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to get session surveillance form');
  }
} 