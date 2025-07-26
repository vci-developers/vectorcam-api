import { FastifyRequest, FastifyReply } from 'fastify';
import { MultipartUpload, Specimen } from '../../../db/models';
import { uploadPart } from '../../../services/s3.service';
import { Readable } from 'stream';

const FLUSH_THRESHOLD = 5 * 1024 * 1024; // 5MB

export const schema = {
  tags: ['Specimen Images'],
  description: 'Append data to multipart upload',
  params: {
    type: 'object',
    required: ['specimen_id', 'upload_id'],
    properties: {
      specimen_id: { type: 'number' },
      upload_id: { type: 'string', pattern: '^\\d+$' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        currentPart: { type: 'number' },
        bufferSize: { type: 'number' }
      }
    }
  }
};

export async function appendUpload(
  request: FastifyRequest<{ 
    Params: { 
      specimen_id: number,
      upload_id: string 
    }
  }>,
  reply: FastifyReply
) {
  try {
    const { specimen_id, upload_id } = request.params;

    // Check if the request is multipart
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Request must be multipart form data' });
    }

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

    if (upload.status !== 'pending' && upload.status !== 'in_progress') {
      return reply.code(400).send({ error: 'Upload is not in a valid state for appending' });
    }

    const parts = request.parts({ limits: { fields: 1 } })

    let fileBuffer: Buffer | null = null;
    let partIndex = 0;

    for await (const part of parts) {
      if (part.type === 'file') {
        if (fileBuffer) {
          part.file.resume();
          return reply.code(400).send({ error: 'Only one file is allowed' });
        }
        fileBuffer = await part.toBuffer()
      } else if (part.fieldname === "partIndex") {
        partIndex = parseInt(part.value as string)
      }
    }

    if (!fileBuffer) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    if (!partIndex || isNaN(partIndex)) {
      return reply.code(400).send({ error: 'partIndex is required and must be a number' });
    }
    
    // Verify part index
    if (partIndex !== upload.currentPart) {
      return reply.code(400).send({ 
        error: 'Invalid part index',
        expected: upload.currentPart,
        received: partIndex
      });
    }

    // Combine with existing buffer data if any
    const existingBufferData = upload.bufferData || Buffer.alloc(0);
    const combinedBufferData = Buffer.concat([existingBufferData, fileBuffer]);

    // Update buffer size and data
    const newBufferSize = combinedBufferData.length;

    // If buffer size exceeds threshold, flush to S3
    if (newBufferSize >= FLUSH_THRESHOLD) {
      // Create a readable stream from the buffer
      const readStream = Readable.from(combinedBufferData);
      // Upload part to S3 with content length using s3PartNumber
      const etag = await uploadPart(
        upload.s3Key,
        upload.s3UploadId,
        upload.s3PartNumber,
        readStream,
        newBufferSize
      );

      // Get existing ETags and add the new one
      const existingEtags = upload.s3PartEtags || [];
      const updatedEtags = [...existingEtags, etag];

      // Update upload record - increment s3PartNumber (for S3), update ETags, reset buffer
      await upload.update({
        currentPart: upload.currentPart + 1,
        s3PartNumber: upload.s3PartNumber + 1,
        s3PartEtags: updatedEtags,
        bufferSize: 0,
        bufferData: null,
        status: 'in_progress'
      });
    } else {
      // If not flushing, just update buffer size and data
      await upload.update({
        currentPart: upload.currentPart + 1,
        bufferSize: newBufferSize,
        bufferData: combinedBufferData,
        status: 'in_progress'
      });
    }

    await upload.reload();

    return reply.code(200).send({
      message: 'Chunk processed successfully',
      currentPart: upload.currentPart,
      bufferSize: upload.bufferSize
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to append upload' });
  }
} 