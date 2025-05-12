import { FastifyRequest, FastifyReply } from 'fastify';
import { getFileStream } from '../../services/s3.service';
import { findSpecimen, handleError } from './common';
import { SpecimenImage } from '../../db/models';

export const schema = {
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' },
      image_id: { type: 'string', pattern: '^\\d+$' }
    },
    required: ['specimen_id', 'image_id']
  }
  // No response schema as this returns a binary stream
};

export async function getImage(
  request: FastifyRequest<{ 
    Params: { 
      specimen_id: string,
      image_id: string 
    } 
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id, image_id } = request.params;
    
    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Find the specific image
    const image = await SpecimenImage.findOne({
      where: { 
        id: parseInt(image_id),
        specimenId: specimen.id
      }
    });

    if (!image) {
      return reply.code(404).send({ error: 'Image not found' });
    }

    try {
      // Get the file stream and content type from S3
      const { stream, contentType } = await getFileStream(image.imageKey);
      
      // Set appropriate headers
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=3600');
      
      // Pipe the stream to the response using Fastify's send method
      return reply.send(stream);
      
    } catch (error) {
      // If the file doesn't exist in S3, return error
      request.log.error(`Failed to get image from S3: ${image.imageKey}`, error);
      reply.code(404).send({ error: 'Image not found in storage' });
    }
  } catch (error) {
    handleError(error, request, reply, 'Failed to get specimen image');
  }
} 