import { FastifyRequest, FastifyReply } from 'fastify';
import { getFileStream } from '../../services/s3.service';
import { findSpecimen, handleError } from './common';

export const schema = {
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' }
    }
  }
  // No response schema as this returns a binary stream
};

export async function getImages(
  request: FastifyRequest<{ Params: { specimen_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;
    
    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // If the specimen has no image, return error
    if (!specimen.imageUrl) {
      return reply.code(404).send({ error: 'No image found for this specimen' });
    }

    // The imageUrl now contains just the S3 key
    const key = specimen.imageUrl;
    
    try {
      // Get the file stream and content type from S3
      const { stream, contentType } = await getFileStream(key);
      
      // Set appropriate headers
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=3600');
      
      // Pipe the stream to the response using Fastify's send method
      return reply.send(stream);
      
    } catch (error) {
      // If the file doesn't exist in S3, return error
      request.log.error(`Failed to get image from S3: ${key}`, error);
      reply.code(404).send({ error: 'Image not found' });
    }
  } catch (error) {
    handleError(error, request, reply, 'Failed to get specimen images');
  }
} 