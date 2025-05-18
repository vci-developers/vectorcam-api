import { FastifyRequest, FastifyReply } from 'fastify';
import { findSpecimen, formatSpecimenResponse, handleError } from './common';

export const schema = {
  tags: ['Specimens'],
  description: 'Get specimen details',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        specimenId: { type: 'string' },
        sessionId: { type: 'number' },
        species: { type: ['string', 'null'] },
        sex: { type: ['string', 'null'] },
        abdomenStatus: { type: ['string', 'null'] },
        thumbnailUrl: { type: ['string', 'null'] },
        thumbnailImageId: { type: ['number', 'null'] },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              url: { type: 'string' }
            }
          }
        },
        yoloBox: {
          type: ['object', 'null'],
          properties: {
            yoloBoxId: { type: 'number' },
            topLeftX: { type: 'number' },
            topLeftY: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' }
          }
        }
      }
    }
  }
};

export async function getSpecimenDetails(
  request: FastifyRequest<{ Params: { specimen_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;

    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    const response = await formatSpecimenResponse(specimen);
    reply.send(response);
  } catch (error) {
    handleError(error, request, reply, 'Failed to get specimen details');
  }
} 