import { FastifyRequest, FastifyReply } from 'fastify';
import { LocationType } from '../../../db/models';
import { formatLocationTypeResponse, findProgramById, handleError } from './common';

interface CreateLocationTypeRequest {
  name: string;
}

export const schema = {
  tags: ['LocationTypes'],
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        locationType: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            programId: { type: 'number' },
            name: { type: 'string' },
          },
        },
      },
    },
  },
};

export async function createLocationType(
  request: FastifyRequest<{ Params: { program_id: number }; Body: CreateLocationTypeRequest }>,
  reply: FastifyReply
) {
  try {
    const { program_id } = request.params;
    const { name } = request.body;

    const program = await findProgramById(program_id);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const locationType = await LocationType.create({
      programId: program_id,
      name,
    });

    return reply.code(200).send({
      message: 'Location type created successfully',
      locationType: formatLocationTypeResponse(locationType),
    });
  } catch (error) {
    return handleError(error, request, reply);
  }
}


