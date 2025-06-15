import { FastifyRequest, FastifyReply } from 'fastify';
import { findSpecimen, handleError } from '../common';
import { SpecimenImage } from '../../../db/models';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Get all specimen images',
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
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              url: { type: 'string' }
            }
          }
        },
        thumbnailUrl: { type: ['string', 'null'] }
      }
    }
  }
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

    // Find all images for this specimen
    const images = await SpecimenImage.findAll({
      where: { specimenId: specimen.id },
      order: [['created_at', 'DESC']]
    });

    if (images.length === 0) {
      return reply.code(200).send({ 
        images: [],
        thumbnailUrl: null,
        thumbnailImageId: null
      });
    }

    // Format the response
    const formattedImages = images.map(img => ({
      id: img.id,
      url: `/specimens/${specimen.specimenId}/images/${img.id}`
    }));

    // Get the thumbnail URL
    let thumbnailUrl = null;
    if (specimen.thumbnailImageId) {
      const thumbnail = images.find(img => img.id === specimen.thumbnailImageId);
      if (thumbnail) {
        thumbnailUrl = `/specimens/${specimen.specimenId}/images/${thumbnail.id}`;
      }
    }

    reply.code(200).send({
      images: formattedImages,
      thumbnailUrl,
      thumbnailImageId: specimen.thumbnailImageId
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to get specimen images');
  }
} 