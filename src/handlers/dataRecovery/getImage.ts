import { FastifyReply, FastifyRequest } from 'fastify';
import { DataRecovery } from '../../db/models';
import { getUploadInfoFromPayload } from './uploadPayload';
import { getFileStreamFromBucket, getMainS3Bucket } from '../../services/s3.service';

export const schema = {
  tags: ['Data Recovery'],
  description:
    'Download the image file for a recovery record when payload.upload.state is uploaded and s3Key is set. Admin only.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'number' },
    },
  },
};

export async function getDataRecoveryImage(
  request: FastifyRequest<{ Params: { id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const record = await DataRecovery.findByPk(request.params.id);
    if (!record) {
      return reply.code(404).send({ error: 'Recovery record not found' });
    }

    const upload = getUploadInfoFromPayload(record.payload);
    if (!upload?.s3Key || upload.state !== 'uploaded') {
      return reply.code(404).send({ error: 'Recovery image not available' });
    }

    const bucket = upload.s3Bucket?.trim() || getMainS3Bucket();
    if (!bucket) {
      return reply.code(500).send({ error: 'S3 bucket is not configured' });
    }

    try {
      const { stream, contentType } = await getFileStreamFromBucket(bucket, upload.s3Key);
      const resolvedContentType = upload.contentType || contentType;
      reply.header('Content-Type', resolvedContentType);
      reply.header('Cache-Control', 'private, max-age=3600');
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
      if (upload.filemd5) {
        reply.header('ETag', `"${upload.filemd5}"`);
      }
      return reply.send(stream);
    } catch (error) {
      request.log.error({ err: error, s3Key: upload.s3Key, bucket }, 'Failed to get recovery image from S3');
      return reply.code(404).send({ error: 'Recovery image not found in storage' });
    }
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to get recovery image' });
  }
}
