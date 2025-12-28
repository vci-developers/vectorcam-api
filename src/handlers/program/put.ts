import { FastifyRequest, FastifyReply } from 'fastify';
import { findProgramById, formatProgramResponse } from './common';
import { Form } from '../../db/models';

interface UpdateProgramRequest {
  name?: string;
  country?: string;
  formVersion?: string | null;
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
      formVersion: { type: ['string', 'null'] },
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
            formVersion: { type: ['string', 'null'] },
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
    const { name, country, formVersion } = request.body;

    const program = await findProgramById(program_id);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    if (formVersion !== undefined) {
      if (formVersion === '') {
        return reply.code(400).send({ error: 'formVersion cannot be empty string' });
      }

      if (formVersion !== null) {
        const published = await Form.findOne({
          where: { programId: program.id, version: formVersion },
        });
        if (!published || published.version === '') {
          return reply.code(400).send({ error: 'formVersion must point to a published form' });
        }
      }
    }

    await program.update({
      name: name !== undefined ? name : program.name,
      country: country !== undefined ? country : program.country,
      formVersion: formVersion !== undefined ? formVersion : program.formVersion,
    });

    return reply.code(200).send({
      message: 'Program updated successfully',
      program: { ...formatProgramResponse(program), formVersion: program.formVersion },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 