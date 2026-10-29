import { FastifyRequest, FastifyReply } from 'fastify';
import { Form, Program } from '../../../db/models';
import { defaultProgramFormWhere } from './common';

export const schema = {
  tags: ['Programs'],
  description: 'List forms for a program',
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
        forms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              programId: { type: 'number' },
              programFormId: { type: 'number' },
              name: { type: 'string' },
              version: { type: 'string' },
              createdAt: { type: ['number', 'null'] },
              updatedAt: { type: ['number', 'null'] },
            },
          },
        },
      },
    },
  },
};

export async function getProgramFormList(
  request: FastifyRequest<{ Params: { program_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const programId = parseInt(request.params.program_id, 10);

    if (isNaN(programId)) {
      return reply.code(400).send({ error: 'Invalid program id' });
    }

    const program = await Program.findByPk(programId, {
      attributes: ['id', 'defaultProgramFormId'],
    });

    const forms = await Form.findAll({
      where: defaultProgramFormWhere(programId, program?.defaultProgramFormId),
      order: [['updatedAt', 'DESC']],
    });

    return reply.send({
      forms: forms.map(form => ({
        id: form.id,
        programId: form.programId,
        programFormId: form.programFormId,
        name: form.name,
        version: form.version,
        createdAt: form.createdAt?.getTime?.() ?? null,
        updatedAt: form.updatedAt?.getTime?.() ?? null,
      })),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to list program forms' });
  }
}

