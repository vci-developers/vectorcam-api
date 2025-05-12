import { FastifyRequest, FastifyReply } from 'fastify';
import { getFile } from '../../services/s3.service';
import { findSpecimen, handleError } from './common';

export const schema = {
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        hasImage: { type: 'boolean' },
        imageUrl: { type: ['string', 'null'] },
        contentType: { type: ['string', 'null'] },
        filename: { type: ['string', 'null'] }
      }
    }
  }
};

export async function getImageMetadata(
  request: FastifyRequest<{ Params: { specimen_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;

    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // If specimen has no image
    if (!specimen.imageUrl) {
      return reply.send({
        hasImage: false,
        imageUrl: null,
        contentType: null,
        filename: null,
      });
    }

    // Get metadata about the image from S3
    try {
      const metadata = await getFile(specimen.imageUrl);
      const contentType = typeof metadata === 'object' && metadata && 'ContentType' in metadata 
        ? metadata.ContentType 
        : 'application/octet-stream';
      
      return reply.send({
        hasImage: true,
        imageUrl: `/specimens/${specimen.id}/images`,
        contentType,
        filename: specimen.imageUrl.split('/').pop(),
      });
    } catch (error) {
      request.log.error(`Failed to get image metadata from S3: ${specimen.imageUrl}`, error);
      return reply.send({
        hasImage: false,
        imageUrl: null,
        contentType: null,
        filename: null,
      });
    }
  } catch (error) {
    handleError(error, request, reply, 'Failed to get image metadata');
  }
} 