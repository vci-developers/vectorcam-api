import { FastifyRequest, FastifyReply } from 'fastify';
import {
  ensureProgramExists,
  listProgramModels,
  programModelResponseSchema,
  serializeProgramModelResponse,
} from './common';

export const schema = {
  tags: ['Program Models'],
  description: 'List all ML model versions for a program',
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
        models: {
          type: 'array',
          items: programModelResponseSchema,
        },
      },
    },
  },
};

export async function getProgramModelList(
  request: FastifyRequest<{ Params: { program_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const programId = parseInt(request.params.program_id, 10);
    if (isNaN(programId)) {
      return reply.code(400).send({ error: 'Invalid program id' });
    }

    const program = await ensureProgramExists(programId);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const models = await listProgramModels(programId);

    return reply.send({
      models: models.map(model => serializeProgramModelResponse(model, { includeDownloadUrl: true })),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to list program models' });
  }
}
