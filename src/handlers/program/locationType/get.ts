import { FastifyRequest, FastifyReply } from 'fastify';
import { LocationType } from '../../../db/models';
import { formatLocationTypeResponse, handleError } from './common';

export const schema = {
  tags: ['LocationTypes'],
  params: {
    type: 'object',
    required: ['program_id', 'location_type_id'],
    properties: {
      program_id: { type: 'number' },
      location_type_id: { type: 'number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        programId: { type: ['number', 'null'] },
        name: { type: 'string' },
      },
    },
  },
};

export async function getLocationType(
  request: FastifyRequest<{ Params: { program_id: number; location_type_id: number } }>,
  reply: FastifyReply
) {
  try {
    const { program_id, location_type_id } = request.params;
    const locationType = await LocationType.findOne({ where: { id: location_type_id, programId: program_id } });
    if (!locationType) {
      return reply.code(404).send({ error: 'Location type not found' });
    }
    return reply.code(200).send(formatLocationTypeResponse(locationType));
  } catch (error) {
    return handleError(error, request, reply);
  }
}


