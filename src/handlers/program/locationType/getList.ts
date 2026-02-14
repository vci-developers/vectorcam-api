import { FastifyRequest, FastifyReply } from 'fastify';
import { LocationType } from '../../../db/models';
import { formatLocationTypeResponse, handleError } from './common';

export const schema = {
  tags: ['LocationTypes'],
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        locationTypes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              programId: { type: 'number' },
              name: { type: 'string' },
              level: { type: 'number' },
            },
          },
        },
      },
    },
  },
};

export async function getLocationTypeList(
  request: FastifyRequest<{ Params: { program_id: number } }>,
  reply: FastifyReply
) {
  try {
    const { program_id } = request.params;

    const locationTypes = await LocationType.findAll({
      where: { programId: program_id },
      order: [['level', 'ASC'], ['id', 'ASC']],
    });
    return reply.code(200).send({
      locationTypes: locationTypes.map(formatLocationTypeResponse),
    });
  } catch (error) {
    return handleError(error, request, reply);
  }
}


