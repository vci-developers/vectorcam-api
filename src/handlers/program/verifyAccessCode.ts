import { FastifyReply, FastifyRequest } from 'fastify';
import { findProgramById } from './common';
import { isValidProgramAccessCode } from '../../utils/programAccessCode';

interface VerifyProgramAccessCodeRequest {
  accessCode: string;
}

export const schema = {
  tags: ['Programs'],
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  body: {
    type: 'object',
    required: ['accessCode'],
    properties: {
      accessCode: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
      },
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export async function verifyProgramAccessCode(
  request: FastifyRequest<{
    Params: { program_id: number };
    Body: VerifyProgramAccessCodeRequest;
  }>,
  reply: FastifyReply
) {
  try {
    const { program_id } = request.params;
    const { accessCode } = request.body;

    const program = await findProgramById(program_id);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    return reply.code(200).send({
      valid: isValidProgramAccessCode(accessCode) && program.accessCode === accessCode,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
