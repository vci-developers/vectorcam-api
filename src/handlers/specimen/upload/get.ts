import { FastifyRequest, FastifyReply } from 'fastify';
import { MultipartUpload } from '../../../db/models';
import { findSpecimen } from '../common';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Get status of a multipart upload',
  params: {
    type: 'object',
    required: ['specimen_id', 'upload_id'],
    properties: {
      specimen_id: { type: 'string' },
      upload_id: { type: 'string', pattern: '^\\d+$' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed'] },
        currentPart: { type: 'number' },
        totalParts: { type: 'number', nullable: true },
        bufferSize: { type: 'number' },
        filemd5: { type: 'string' }
      }
    }
  }
};

export default async function getUploadStatus(
  request: FastifyRequest<{ 
    Params: { 
      specimen_id: string,
      upload_id: string 
    }
  }>,
  reply: FastifyReply
) {
  try {
    const { specimen_id, upload_id } = request.params;

    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Get the upload record
    const upload = await MultipartUpload.findOne({
      where: {
        id: parseInt(upload_id),
        specimenId: specimen.id
      }
    });

    if (!upload) {
      return reply.code(404).send({ error: 'Upload not found' });
    }

    return reply.code(200).send({
      status: upload.status,
      currentPart: upload.currentPart,
      totalParts: upload.totalParts,
      bufferSize: upload.bufferSize,
      filemd5: upload.filemd5
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to get upload status' });
  }
} 