import { FastifyRequest, FastifyReply } from 'fastify';
import { MultipartUpload, Specimen } from '../../../db/models';
import { initiateMultipartUpload } from '../../../services/s3.service';
import { createHash } from 'crypto';

const ACCEPTED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const schema = {
  tags: ['Specimen Images'],
  description: 'Initiate multipart upload for specimen image',
  params: {
    type: 'object',
    required: ['specimen_id'],
    properties: {
      specimen_id: { type: 'number' }
    }
  },
  body: {
    type: 'object',
    required: ['contentType', 'filemd5'],
    properties: {
      contentType: { 
        type: 'string',
        enum: ACCEPTED_CONTENT_TYPES
      },
      filemd5: {
        type: 'string',
        pattern: '^[a-f0-9]{32}$'
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        uploadId: { type: 'number' },
        currentPart: { type: 'number' }
      }
    }
  }
};

export async function initiateUpload(
  request: FastifyRequest<{ 
    Params: { specimen_id: number },
    Body: { contentType: string, filemd5: string }
  }>,
  reply: FastifyReply
) {
  try {
    const { specimen_id } = request.params;
    const { contentType, filemd5 } = request.body;

    // Verify content type is accepted
    if (!ACCEPTED_CONTENT_TYPES.includes(contentType)) {
      return reply.code(400).send({ 
        error: 'Invalid content type',
        expected: ACCEPTED_CONTENT_TYPES,
        received: contentType
      });
    }

    const specimen = await Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Check for existing upload with same specimenId and filemd5
    const existingUpload = await MultipartUpload.findOne({
      where: {
        specimenId: specimen.id,
        filemd5
      }
    });
    if (existingUpload) {
      return reply.code(409).send({ error: 'A multipart upload for this file already exists for this specimen.' });
    }

    // Get file extension from content type
    const extension = contentType.split('/')[1];

    // Create upload record in database first to get the ID
    const upload = await MultipartUpload.create({
      specimenId: specimen.id,
      status: 'pending',
      filemd5
    });

    // Generate MD5 hash of specimen ID and upload ID
    const hash = createHash('md5')
      .update(`${specimen.id}-${upload.id}`)
      .digest('hex');

    // Create S3 key using the hash and content type extension
    const s3Key = `specimens/${specimen.specimenId}/${hash}.${extension}`;

    // Create multipart upload in S3
    const { uploadId: s3UploadId } = await initiateMultipartUpload(s3Key, contentType);

    // Update upload record with S3 details
    await upload.update({
      s3UploadId,
      s3Key,
    });

    return reply.code(200).send({
      uploadId: upload.id,
      currentPart: upload.currentPart
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to initiate upload' });
  }
} 