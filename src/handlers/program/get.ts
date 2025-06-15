import { FastifyRequest, FastifyReply } from 'fastify';
import { findProgramById, formatProgramResponse } from './common';

export const schema = {
  tags: ['Programs'],
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        programId: { type: 'number' },
        name: { type: 'string' },
        country: { type: 'string' },
      },
    },
  },
};

export async function getProgramDetails(
  request: FastifyRequest<{ Params: { program_id: number } }>,
  reply: FastifyReply
) {
  try {
    const { program_id } = request.params;

    const program = await findProgramById(program_id);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    return reply.code(200).send(formatProgramResponse(program));
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 