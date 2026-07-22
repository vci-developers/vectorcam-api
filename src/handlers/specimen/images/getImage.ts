import { FastifyRequest, FastifyReply } from 'fastify';
import { getFileStream, getPresignedDownloadUrl } from '../../../services/s3.service';
import { getSignedUrlExpiresInSeconds } from '../../../services/signedUrl.service';
import { handleError, findSpecimenImage } from '../common';
import { Specimen } from '../../../db/models';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Get a specimen image. Requires read access to the specimen, or a valid signed URL (signature query param). Signed requests redirect to a presigned S3 URL instead of streaming through the API.',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'number' },
      image_id: { type: 'string' }
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
    
    const specimen = await Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    const image = await findSpecimenImage(specimen.id, image_id);

    if (!image) {
      return reply.code(404).send({ error: 'Image not found' });
    }

    const pathname = `/specimens/${specimen.id}/images/${image.id}`;

    if (request.isSignedUrl) {
      try {
        const presignedUrl = await getPresignedDownloadUrl(
          image.imageKey,
          getSignedUrlExpiresInSeconds(pathname)
        );
        reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
        return reply.redirect(presignedUrl);
      } catch (error) {
        request.log.error(`Failed to generate presigned URL for S3 key: ${image.imageKey}`, error);
        return reply.code(404).send({ error: 'Image not found in storage' });
      }
    }

    try {
      // Get the file stream and content type from S3
      const { stream, contentType } = await getFileStream(image.imageKey);
      
      // Set appropriate headers
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=3600');
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
      
      // Pipe the stream to the response using Fastify's send method
      return reply.send(stream);
      
    } catch (error) {
      // If the file doesn't exist in S3, return error
      request.log.error(`Failed to get image from S3: ${image.imageKey}`, error);
      return reply.code(404).send({ error: 'Image not found in storage' });
    }
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get specimen image');
  }
} 
