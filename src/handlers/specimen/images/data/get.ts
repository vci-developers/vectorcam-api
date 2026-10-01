import { FastifyRequest, FastifyReply } from "fastify";
import { SpecimenImage, Specimen } from "../../../../db/models";
import {
  handleError,
  findSpecimenImage,
  formatImageResponse,
  enrichSpecimenImageInferenceData,
  specimenImageInferenceResponseSchemaProperties,
} from '../../common';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Get a specimen image data record',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'number' },
      image_id: { type: 'string' }
    },
    required: ['specimen_id', 'image_id']
  },
  response: {
    200: {
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
  }
};

export async function getImageData(
    request: FastifyRequest<{ Params: { specimen_id: string; image_id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { specimen_id, image_id } = request.params;
      const specimen = await Specimen.findByPk(specimen_id);
      if (!specimen) {
        return reply.code(404).send({ error: 'Specimen not found' });
      }
      let image: SpecimenImage | null = await findSpecimenImage(specimen.id, image_id);
      if (!image) {
        return reply.code(404).send({ error: 'Image not found' });
      }
      await enrichSpecimenImageInferenceData(image);
      return reply.code(200).send({
        ...formatImageResponse(specimen.id, image),
        filemd5: image.filemd5,
      });
    } catch (error) {
      return handleError(error, request, reply, 'Failed to get specimen image info');
    }
  } 
  