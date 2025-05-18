import { FastifyRequest, FastifyReply } from 'fastify';
import { MultipartUpload, SpecimenImage } from '../../../db/models';
import { uploadPart, completeMultipartUpload, getFileStream } from '../../../services/s3.service';
import { Readable } from 'stream';
import { createHash } from 'crypto';
import { findSpecimen } from '../common';

export const schema = {
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
        message: { type: 'string' },
        imageId: { type: 'number' },
        imageUrl: { type: 'string' }
      }
    }
  }
};

export default async function completeUpload(
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

    if (upload.status !== 'in_progress') {
      return reply.code(400).send({ error: 'Upload is not in progress' });
    }

    const parts: { PartNumber: number; ETag: string }[] = [];

    // If there's any remaining buffer, upload it as the final part
    if (upload.bufferSize > 0 && upload.bufferData) {
      // Create a readable stream from the buffer
      const readStream = Readable.from(upload.bufferData);

      // Upload final part to S3
      const etag = await uploadPart(
        upload.s3Key,
        upload.s3UploadId,
        upload.currentPart,
        readStream,
        upload.bufferSize
      );

      parts.push({
        PartNumber: upload.currentPart,
        ETag: etag
      });
    }

    // Complete the multipart upload
    await completeMultipartUpload(
      upload.s3Key,
      upload.s3UploadId,
      parts
    );

    // Verify file integrity by calculating MD5 of the complete file
    const { stream } = await getFileStream(upload.s3Key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);
    const calculatedMd5 = createHash('md5').update(fileBuffer).digest('hex');

    if (calculatedMd5 !== upload.filemd5) {
      // Delete the upload record
      await upload.destroy();

      return reply.code(400).send({ 
        error: 'File integrity check failed',
        expected: upload.filemd5,
        received: calculatedMd5
      });
    }

    // Create SpecimenImage record
    const image = await SpecimenImage.create({
      specimenId: upload.specimenId,
      imageKey: upload.s3Key
    });

    // If there's no current thumbnail
    if (!specimen.thumbnailImageId) {
      // Update specimen to use this as the thumbnail
      await specimen.update({ thumbnailImageId: image.id });
    }

    // Update upload status
    await upload.update({
      status: 'completed',
      totalParts: upload.currentPart,
      bufferData: null
    });

    return reply.code(200).send({
      message: 'Upload completed successfully',
      imageId: image.id,
      imageUrl: `/specimens/${specimen.specimenId}/images/${image.id}`
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to complete upload' });
  }
} 