import { FastifyRequest, FastifyReply } from 'fastify';
import { findSessionById, handleError } from './common';
import { Specimen } from '../../db/models';

export const schema = {
  tags: ['Sessions'],
  description: 'Get specimens for a session',
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
        specimens: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              specimenId: { type: 'string' },
              thumbnailUrl: { type: ['string', 'null'] },
              thumbnailImageId: { type: ['number', 'null'] },
              species: { type: ['string', 'null'] },
              sex: { type: ['string', 'null'] },
              abdomenStatus: { type: ['string', 'null'] }
            }
          }
        }
      }
    }
  }
};

export async function getSessionSpecimens(
  request: FastifyRequest<{ Params: { session_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { session_id } = request.params;

    const session = await findSessionById(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Get all specimens for this session
    const specimens = await Specimen.findAll({
      where: { sessionId: session_id },
      order: [['createdAt', 'DESC']],
    });

    return reply.send({
      specimens: specimens.map(specimen => ({
        id: specimen.id,
        specimenId: specimen.specimenId,
        thumbnailUrl: specimen.thumbnailImageId ? `/specimens/${specimen.id}/images/${specimen.thumbnailImageId}` : null,
        thumbnailImageId: specimen.thumbnailImageId,
        species: specimen.species,
        sex: specimen.sex,
        abdomenStatus: specimen.abdomenStatus,
      })),
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get session specimens');
  }
} 