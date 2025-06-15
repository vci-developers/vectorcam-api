import { FastifyRequest, FastifyReply } from 'fastify';
import { Program } from '../../db/models';
import { formatProgramResponse } from './common';

interface CreateProgramRequest {
  name: string;
  country: string;
}

export const schema = {
  tags: ['Programs'],
  body: {
    type: 'object',
    required: ['name', 'country'],
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

export async function createProgram(
  request: FastifyRequest<{ Body: CreateProgramRequest }>,
  reply: FastifyReply
) {
  try {
    const { name, country } = request.body;

    const program = await Program.create({
      name,
      country,
    });

    return reply.code(200).send({
      message: 'Program created successfully',
      program: formatProgramResponse(program),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 