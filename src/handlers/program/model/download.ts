import { FastifyRequest, FastifyReply } from 'fastify';
import { getPresignedDownloadUrl } from '../../../services/s3.service';
import { config } from '../../../config/environment';
import {
  ensureProgramExists,
  findProgramModelByModelId,
  TFLITE_CONTENT_TYPE,
} from './common';

export const schema = {
  tags: ['Program Models'],
  description:
    'Download an ML model file for a program by modelId. Returns HTTP 302 redirect to a presigned S3 URL (supports byte-range resume on the S3 URL).',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      model_id: { type: 'string' },
    },
    required: ['program_id', 'model_id'],
  },
};

export async function downloadProgramModel(
  request: FastifyRequest<{ Params: { program_id: string; model_id: string } }>,
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

    const programModel = await findProgramModelByModelId(programId, request.params.model_id);
    if (!programModel) {
      return reply.code(404).send({ error: 'Model not found' });
    }

    return redirectToProgramModelFile(request, reply, programModel.s3Key, programModel.modelId);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to download program model' });
  }
}

async function redirectToProgramModelFile(
  request: FastifyRequest,
  reply: FastifyReply,
  s3Key: string,
  modelId: string
): Promise<void> {
  try {
    const filename = `${modelId}.tflite`;
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
