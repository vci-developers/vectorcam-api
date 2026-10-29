import { FastifyRequest, FastifyReply } from 'fastify';
import { ProgramForm } from '../../../db/models';
import {
  enforceUserProgramScope,
  programFormDefinitionSchema,
  serializeProgramFormDefinition,
} from './common';

export const schema = {
  tags: ['Programs'],
  description: 'List logical program forms for a program',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
    },
    required: ['program_id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        programForms: {
          type: 'array',
          items: programFormDefinitionSchema,
        },
      },
    },
  },
};

export async function listProgramForms(
  request: FastifyRequest<{ Params: { program_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const programId = parseInt(request.params.program_id, 10);
    if (isNaN(programId)) {
      return reply.code(400).send({ error: 'Invalid program id' });
    }

    if (!enforceUserProgramScope(request, reply, programId)) {
      return;
    }

    const programForms = await ProgramForm.findAll({
      where: { programId },
      order: [['id', 'ASC']],
    });

    return reply.send({
      programForms: programForms.map(serializeProgramFormDefinition),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to list program forms' });
  }
}
