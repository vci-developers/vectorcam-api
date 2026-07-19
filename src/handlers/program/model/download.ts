import { FastifyRequest, FastifyReply } from 'fastify';
import { getFileStream } from '../../../services/s3.service';
import {
  ensureProgramExists,
  findProgramModelByVersion,
  resolveCurrentProgramModel,
} from './common';

export const schema = {
  tags: ['Program Models'],
  description: 'Download the current ML model file for a program',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
    },
    required: ['program_id'],
  },
};

export async function downloadProgramModelCurrent(
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

    return streamProgramModelFile(request, reply, programModel.s3Key, programModel.version);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to download program model' });
  }
}

export const versionDownloadSchema = {
  tags: ['Program Models'],
  description: 'Download a specific ML model version for a program',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      version: { type: 'string' },
    },
    required: ['program_id', 'version'],
  },
};

export async function downloadProgramModelVersion(
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

    return streamProgramModelFile(request, reply, programModel.s3Key, programModel.version);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to download program model' });
  }
}

async function streamProgramModelFile(
  request: FastifyRequest,
  reply: FastifyReply,
  s3Key: string,
  version: string
): Promise<void> {
  try {
    const { stream, contentType } = await getFileStream(s3Key);

    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `attachment; filename="${version}.tflite"`);
    reply.header('Cache-Control', 'private, max-age=3600');

    return reply.send(stream);
  } catch (error) {
    request.log.error(`Failed to get model from S3: ${s3Key}`, error);
    return reply.code(404).send({ error: 'Model file not found in storage' });
  }
}
