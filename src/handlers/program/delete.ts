import { FastifyRequest, FastifyReply } from 'fastify';
import { findProgramById, hasAssociatedSites } from './common';

export const schema = {
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
        message: { type: 'string' }
      }
    }
  }
};

export async function deleteProgram(
  request: FastifyRequest<{ Params: { program_id: number } }>,
  reply: FastifyReply
) {
  try {
    const { program_id } = request.params;

    const program = await findProgramById(program_id);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const hasSites = await hasAssociatedSites(program_id);
    if (hasSites) {
      return reply.code(400).send({
        error: 'Cannot delete program with associated sites',
      });
    }

    await program.destroy();

    return reply.code(200).send({
      message: 'Program deleted successfully',
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 