import { FastifyRequest, FastifyReply } from 'fastify';
import { uploadFileStream } from '../../services/s3.service';
import { findSpecimen, handleError } from './common';

export const schema = {
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' }
    }
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        imageUrl: { type: 'string' }
      }
    }
  }
};

export async function uploadImage(
  request: FastifyRequest<{ Params: { specimen_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    // Check if the request is multipart
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Request is not multipart' });
    }

    // Get specimenId from form data
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file provided' });
    }

    const { specimen_id } = request.params;

    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Validate file type
    const contentType = data.mimetype;
    if (!contentType.startsWith('image/')) {
      return reply.code(400).send({ error: 'Only image files are allowed' });
    }

    // Generate a unique file name
    const fileExtension = contentType.split('/')[1];
    const fileName = `specimens/${specimen.id}/${Date.now()}.${fileExtension}`;

    // Create a readable stream from the file
    const fileStream = data.file;
    
    // Stream directly to S3 without buffering entire file in memory
    const imagePath = await uploadFileStream(fileName, fileStream, contentType);

    // Update specimen with image path
    await specimen.update({ imageUrl: imagePath });

    reply.code(201).send({
      message: 'Image uploaded successfully',
      imageUrl: `/specimens/${specimen.id}/images`,
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to upload specimen image');
  }
} 