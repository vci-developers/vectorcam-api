import { FastifyRequest, FastifyReply } from 'fastify';
import { findProgramById, formatProgramResponse } from './common';

interface UpdateProgramRequest {
  name?: string;
  country?: string;
}

export const schema = {
  tags: ['Programs'],
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' }
    }
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      country: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        program: {
          type: 'object',
          properties: {
            programId: { type: 'number' },
            name: { type: 'string' },
            country: { type: 'string' },
          },
        },
      },
    },
  },
};

export async function updateProgram(
  request: FastifyRequest<{ 
    Params: { program_id: number };
    Body: UpdateProgramRequest;
  }>,
  reply: FastifyReply
) {
  try {
    const { program_id } = request.params;
    const { name, country } = request.body;

    const program = await findProgramById(program_id);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    await program.update({
      name: name !== undefined ? name : program.name,
      country: country !== undefined ? country : program.country,
    });

    return reply.code(200).send({
      message: 'Program updated successfully',
      program: formatProgramResponse(program),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 