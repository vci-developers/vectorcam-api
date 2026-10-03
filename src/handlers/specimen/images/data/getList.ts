import { FastifyRequest, FastifyReply } from 'fastify';
import SpecimenImage from '../../../../db/models/SpecimenImage';
import { Specimen } from '../../../../db/models';
import {
  formatImageResponse,
  getSpecimenImageInferenceInclude,
  specimenImageInferenceResponseSchemaProperties,
} from '../../common';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Get all specimen images',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'number' }
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
              url: { type: 'string' },
              metadata: { type: ['object', 'null'], additionalProperties: true },
              species: { type: ['string', 'null'] },
              sex: { type: ['string', 'null'] },
              abdomenStatus: { type: ['string', 'null'] },
              appSpecies: { type: ['string', 'null'] },
              appSex: { type: ['string', 'null'] },
              appAbdomenStatus: { type: ['string', 'null'] },
              capturedAt: { type: ['number', 'null'] },
              submittedAt: { type: 'number' },
              ...specimenImageInferenceResponseSchemaProperties,
              filemd5: { type: 'string' }
            }
          }
        },
        thumbnailUrl: { type: ['string', 'null'] },
        thumbnailImageId: { type: ['number', 'null'] }
      }
    }
  }
};

export async function getImageList(
  request: FastifyRequest<{ Params: { specimen_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;
    
    const specimen = await Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Find all images for this specimen
    const images = await SpecimenImage.findAll({
      where: { specimenId: specimen.id },
      include: getSpecimenImageInferenceInclude(),
      order: [['created_at', 'DESC']],
    });

    if (images.length === 0) {
      return reply.code(200).send({ 
        images: [],
        thumbnailUrl: null,
        thumbnailImageId: null
      });
    }

    // Format the response
    const formattedImages = images.map((img) => ({
      ...formatImageResponse(specimen.id, img),
      filemd5: img.filemd5,
    }));

    // Get the thumbnail URL
    let thumbnailUrl = null;
    if (specimen.thumbnailImageId) {
      const thumbnail = images.find(img => img.id === specimen.thumbnailImageId);
      if (thumbnail) {
        thumbnailUrl = `/specimens/${specimen.id}/images/${thumbnail.id}`;
      }
    }

    return reply.code(200).send({
      images: formattedImages,
      thumbnailUrl,
      thumbnailImageId: specimen.thumbnailImageId
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 