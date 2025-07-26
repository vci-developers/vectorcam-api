import { FastifyRequest, FastifyReply } from 'fastify';
import { MultipartUpload, Specimen, SpecimenImage } from '../../../db/models';
import { uploadPart, completeMultipartUpload, getFileStream } from '../../../services/s3.service';
import { Readable } from 'stream';
import { createHash } from 'crypto';
import { findSpecimenImage } from '../common';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Complete multipart upload',
  params: {
    type: 'object',
    required: ['specimen_id', 'upload_id'],
    properties: {
      specimen_id: { type: 'number' },
      upload_id: { type: 'string', pattern: '^\\d+$' }
    }
  },
  body: {
    type: 'object',
    properties: {
      imageId: { type: 'string' }
    },
    required: []
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

export async function completeUpload(
  request: FastifyRequest<{
    Params: {
      specimen_id: number,
      upload_id: string
    },
    Body: {
      imageId?: string
    }
  }>,
  reply: FastifyReply
) {
  try {
    const { specimen_id, upload_id } = request.params;
    const { imageId } = request.body || {};

    const specimen = await Specimen.findByPk(specimen_id);
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

    // Add all previously uploaded parts
    const existingEtags = upload.s3PartEtags || [];
    existingEtags.forEach((etag, index) => {
      parts.push({
        PartNumber: index + 1, // S3 part numbers start at 1
        ETag: etag
      });
    });

    // If there's any remaining buffer, upload it as the final part
    if (upload.bufferSize > 0 && upload.bufferData) {
      // Create a readable stream from the buffer
      const readStream = Readable.from(upload.bufferData);

      // Upload final part to S3 using s3PartNumber
      const etag = await uploadPart(
        upload.s3Key,
        upload.s3UploadId,
        upload.s3PartNumber,
        readStream,
        upload.bufferSize
      );

      parts.push({
        PartNumber: upload.s3PartNumber,
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
      // Set the upload status to failed instead of deleting the record
      await upload.update({ status: 'failed' });

      return reply.code(400).send({
        error: 'File integrity check failed',
        expected: upload.filemd5,
        received: calculatedMd5
      });
    }

    let image;
    if (imageId) {
      image = await findSpecimenImage(specimen.id, imageId);
      if (!image) {
        return reply.code(404).send({ error: 'Image not found' });
      }
      if (image?.filemd5 != calculatedMd5) {
        return reply.code(400).send({
          error: 'File md5 mismatch',
          expected: image?.filemd5,
          received: calculatedMd5
        });
      }
    } else {
      // Check for uniqueness of filemd5 under the same specimen
      const existingImage = await SpecimenImage.findOne({ 
        where: { filemd5: calculatedMd5, specimenId: upload.specimenId } 
      });
      if (existingImage) {
        return reply.code(409).send({ 
          error: 'A specimen image with this filemd5 already exists for this specimen' 
        });
      }

      // Create SpecimenImage record
      image = await SpecimenImage.create({
        specimenId: upload.specimenId,
        imageKey: upload.s3Key,
        filemd5: calculatedMd5
      });
    }

    // Update specimen to use this as the thumbnail
    await specimen.update({ thumbnailImageId: image.id });

    // Update upload status
    await upload.update({
      status: 'completed',
      totalParts: upload.currentPart,
      bufferData: null,
      bufferSize: 0,
      s3PartEtags: []
    });

    return reply.code(200).send({
      message: 'Upload completed successfully',
      imageId: image.id,
      imageUrl: `/specimens/${specimen.id}/images/${image.id}`
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to complete upload' });
  }
} 