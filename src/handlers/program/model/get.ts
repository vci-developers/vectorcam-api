import { FastifyRequest, FastifyReply } from 'fastify';
import {
  ensureProgramExists,
  findProgramModelByVersion,
  programModelResponseSchema,
  serializeProgramModelResponse,
} from './common';

export const schema = {
  tags: ['Program Models'],
  description: 'Get ML model metadata for a specific version',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      version: { type: 'string' },
    },
    required: ['program_id', 'version'],
  },
  response: {
    200: programModelResponseSchema,
  },
};

export async function getProgramModel(
  request: FastifyRequest<{ Params: { program_id: string; version: string } }>,
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

    const programModel = await findProgramModelByVersion(programId, request.params.version);
    if (!programModel) {
      return reply.code(404).send({ error: 'Model version not found' });
    }

    return reply.send(
      serializeProgramModelResponse(programModel, { includeDownloadUrl: true })
    );
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to get program model' });
  }
}
