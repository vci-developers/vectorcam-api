import { FastifyRequest, FastifyReply } from "fastify";
import { SpecimenImage, InferenceResult, Specimen } from "../../../../db/models";
import { handleError, findSpecimenImage, formatImageResponse } from '../../common';

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
        originalSpecies: { type: ['string', 'null'] },
        originalSex: { type: ['string', 'null'] },
        originalAbdomenStatus: { type: ['string', 'null'] },
        capturedAt: { type: ['number', 'null'] },
        submittedAt: { type: 'number' },
        inferenceResult: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              properties: {
                id: { type: 'number' },
                bboxTopLeftX: { type: 'number' },
                bboxTopLeftY: { type: 'number' },
                bboxWidth: { type: 'number' },
                bboxHeight: { type: 'number' },
                bboxConfidence: { type: 'number' },
                bboxClassId: { type: 'number' },
                speciesLogits: { type: 'array', items: { type: 'number' } },
                sexLogits: { type: 'array', items: { type: 'number' } },
                abdomenStatusLogits: { type: 'array', items: { type: 'number' } },
                speciesInferenceDuration: { type: ['number', 'null'] },
                sexInferenceDuration: { type: ['number', 'null'] },
                abdomenStatusInferenceDuration: { type: ['number', 'null'] },
                bboxDetectionDuration: { type: ['number', 'null'] }
              }
            }
          ]
        },
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
      const inferenceResult = await InferenceResult.findOne({
        where: { specimenImageId: image.id }
      });
      (image as SpecimenImage & { inferenceResult?: InferenceResult | null }).inferenceResult =
        inferenceResult ?? null;
      return reply.code(200).send({
        ...formatImageResponse(specimen.id, image),
        filemd5: image.filemd5,
      });
    } catch (error) {
      return handleError(error, request, reply, 'Failed to get specimen image info');
    }
  } 
  