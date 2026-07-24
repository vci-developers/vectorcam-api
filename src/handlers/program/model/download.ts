import { FastifyRequest, FastifyReply } from 'fastify';
import { getPresignedDownloadUrl } from '../../../services/s3.service';
import { config } from '../../../config/environment';
import {
  ensureProgramExists,
  findProgramModelByVersion,
  resolveCurrentProgramModel,
  TFLITE_CONTENT_TYPE,
} from './common';

export const schema = {
  tags: ['Program Models'],
  description:
    'Download the current ML model file for a program. Returns HTTP 302 redirect to a presigned S3 URL (supports byte-range resume on the S3 URL).',
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

    return redirectToProgramModelFile(request, reply, programModel.s3Key, programModel.version);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to download program model' });
  }
}

export const versionDownloadSchema = {
  tags: ['Program Models'],
  description:
    'Download a specific ML model version for a program. Returns HTTP 302 redirect to a presigned S3 URL (supports byte-range resume on the S3 URL).',
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

    return redirectToProgramModelFile(request, reply, programModel.s3Key, programModel.version);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to download program model' });
  }
}

async function redirectToProgramModelFile(
  request: FastifyRequest,
  reply: FastifyReply,
  s3Key: string,
  version: string
): Promise<void> {
  try {
    const filename = `${version}.tflite`;
    const presignedUrl = await getPresignedDownloadUrl(
      s3Key,
      config.signedUrl.modelExpiresInSeconds,
      {
        responseContentDisposition: `attachment; filename="${filename}"`,
        responseContentType: TFLITE_CONTENT_TYPE,
      }
    );

    reply.header('Cache-Control', 'private, no-store');
    return reply.redirect(presignedUrl);
  } catch (error) {
    request.log.error(`Failed to get model from S3: ${s3Key}`, error);
    return reply.code(404).send({ error: 'Model file not found in storage' });
  }
}
