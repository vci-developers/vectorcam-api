import { FastifyRequest, FastifyReply } from 'fastify';
import {
  ensureProgramExists,
  programModelResponseSchema,
  resolveCurrentProgramModel,
  serializeProgramModelResponse,
} from './common';

export const schema = {
  tags: ['Program Models'],
  description: 'Get the current ML model metadata for a program',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
    },
    required: ['program_id'],
  },
  response: {
    200: programModelResponseSchema,
  },
};

export async function getProgramModelCurrent(
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

    const programModel = await resolveCurrentProgramModel(programId);
    if (!programModel) {
      return reply.code(404).send({ error: 'No model found for this program' });
    }

    return reply.send(
      serializeProgramModelResponse(programModel, { includeDownloadUrl: true })
    );
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to get current program model' });
  }
}
