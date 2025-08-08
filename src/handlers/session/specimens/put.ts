import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { Specimen, SpecimenImage } from '../../../db/models';
import { formatSpecimenResponse, handleError } from '../../specimen/common';
import { findSession, findSessionSpecimen } from '../common';

export const schema = {
  tags: ['Sessions'],
  description: 'Update a specimen for a session by specimen_id',
  params: {
    type: 'object',
    required: ['session_id', 'specimen_id'],
    properties: {
      session_id: { type: 'string' },
      specimen_id: { type: 'string' }
    }
  },
  body: {
    type: 'object',
    properties: {
      specimenId: { type: 'string' },
      thumbnailImageId: { type: 'number' }
    }
  },
  response: {
    200: {
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
                            abdomenStatusLogits: { type: 'array', items: { type: 'number' } },
                            speciesInferenceDuration: { type: ['number', 'null'] },
                            sexInferenceDuration: { type: ['number', 'null'] },
                            abdomenStatusInferenceDuration: { type: ['number', 'null'] }
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

export async function updateSessionSpecimen(
  request: FastifyRequest<{ Params: { session_id: string; specimen_id: string }; Body: { specimenId?: string; thumbnailImageId?: number } }>,
  reply: FastifyReply
) {
  const { session_id, specimen_id } = request.params;
  const { specimenId, thumbnailImageId } = request.body;
  try {
    // Fetch session first
    const session = await findSession(session_id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    
    const specimen = await findSessionSpecimen(session.id, specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }
    // If changing specimenId, check uniqueness within session
    if (specimenId && specimenId !== specimen.specimenId) {
      const exists = await Specimen.findOne({
        where: {
          sessionId: Number(session_id),
          specimenId,
          id: { [Op.ne]: specimen.id }
        }
      });
      if (exists) {
        return reply.code(409).send({ error: 'A specimen with this id already exists for this session' });
      }
    }
    // If updating thumbnailImageId, check it belongs to this specimen
    if (thumbnailImageId !== undefined) {
      const image = await SpecimenImage.findOne({ where: { id: thumbnailImageId, specimenId: specimen.id } });
      if (!image) {
        return reply.code(400).send({ error: 'The specified image does not exist or does not belong to this specimen' });
      }
    }
    await specimen.update({
      specimenId: specimenId !== undefined ? specimenId : specimen.specimenId,
      thumbnailImageId: thumbnailImageId !== undefined ? thumbnailImageId : specimen.thumbnailImageId
    });
    const updated = await specimen.reload();
    const formatted = await formatSpecimenResponse(updated, false);
    return reply.send({ message: 'Specimen updated successfully', specimen: formatted });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to update specimen');
  }
} 