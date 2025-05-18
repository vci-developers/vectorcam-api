import { FastifyRequest, FastifyReply } from 'fastify';
import { MultipartUpload } from '../../../db/models';
import { uploadPart } from '../../../services/s3.service';
import { Readable } from 'stream';
import { findSpecimen } from '../common';
import { MultipartFile } from '@fastify/multipart';

const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
const FLUSH_THRESHOLD = 5 * 1024 * 1024; // 5MB

export const schema = {
  tags: ['Specimen Images'],
  description: 'Append data to multipart upload',
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
        currentPart: { type: 'number' },
        bufferSize: { type: 'number' }
      }
    }
  }
};

export default async function appendUpload(
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

    // Check if the request is multipart
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Request must be multipart form data' });
    }

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

    if (upload.status !== 'pending' && upload.status !== 'in_progress') {
      return reply.code(400).send({ error: 'Upload is not in a valid state for appending' });
    }

    const parts = request.parts({ limits: { fileSize: CHUNK_SIZE, fields: 1 } })

    let file: MultipartFile | null = null;
    let partIndex = 0;

    for await (const part of parts) {
      if (part.type === 'file') {
        if (file) {
          return reply.code(400).send({ error: 'Only one file is allowed' });
        }
        file = part;
      } else if (part.fieldname === "partIndex") {
        partIndex = parseInt(part.value as string)
      }
    }

    if (!file) {
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


    // Read the chunk data into a buffer
    const newBufferData = await file.toBuffer();

    // Combine with existing buffer data if any
    const existingBufferData = upload.bufferData || Buffer.alloc(0);
    const combinedBufferData = Buffer.concat([existingBufferData, newBufferData]);

    // Update buffer size and data
    const newBufferSize = combinedBufferData.length;
    await upload.update({ 
      bufferSize: newBufferSize,
      bufferData: combinedBufferData,
      status: 'in_progress'
    });

    // If buffer size exceeds threshold, flush to S3
    if (newBufferSize >= FLUSH_THRESHOLD) {
      // Create a readable stream from the buffer
      const readStream = Readable.from(combinedBufferData);
      
      // Upload part to S3 with content length
      await uploadPart(
        upload.s3Key,
        upload.s3UploadId,
        upload.currentPart,
        readStream,
        newBufferSize
      );

      // Update upload record
      await upload.update({
        currentPart: upload.currentPart + 1,
        bufferSize: 0,
        bufferData: null
      });

      return reply.code(200).send({
        message: 'Chunk uploaded successfully',
        currentPart: upload.currentPart,
        bufferSize: 0
      });
    }

    return reply.code(200).send({
      message: 'Chunk buffered successfully',
      currentPart: upload.currentPart,
      bufferSize: newBufferSize
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to append upload' });
  }
} 