import { FastifyRequest, FastifyReply } from "fastify";
import { SpecimenImage, InferenceResult } from "../../../../db/models";
import { findSpecimen, handleError } from "../../common";

export const schema = {
  tags: ['Specimen Images'],
  description: 'Get a specimen image data record',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' },
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
        species: { type: ['string', 'null'] },
        sex: { type: ['string', 'null'] },
        abdomenStatus: { type: ['string', 'null'] },
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
                speciesProbabilities: { type: 'array', items: { type: 'number' } },
                sexProbabilities: { type: 'array', items: { type: 'number' } },
                abdomenStatusProbabilities: { type: 'array', items: { type: 'number' } }
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
      const specimen = await findSpecimen(specimen_id);
      if (!specimen) {
        return reply.code(404).send({ error: 'Specimen not found' });
      }
      // Check if image_id is a number (integer string)
      const isNumericId = /^\d+$/.test(image_id);
      let image: SpecimenImage | null = null;
      if (isNumericId) {
        image = await SpecimenImage.findOne({
          where: {
            id: parseInt(image_id, 10),
            specimenId: specimen.id
          }
        });
        if (!image) {
          image = await SpecimenImage.findOne({
            where: {
              filemd5: image_id,
              specimenId: specimen.id
            }
          });
        }
      } else {
        image = await SpecimenImage.findOne({
          where: {
            filemd5: image_id,
            specimenId: specimen.id
          }
        });
      }
      if (!image) {
        return reply.code(404).send({ error: 'Image not found' });
      }
      const inferenceResult = await InferenceResult.findOne({
        where: { specimenImageId: image.id }
      });
      return reply.code(200).send({
        id: image.id,
        url: `/specimens/${specimen.specimenId}/images/${image.id}`,
        species: image.species,
        sex: image.sex,
        abdomenStatus: image.abdomenStatus,
        capturedAt: image.capturedAt ? image.capturedAt.getTime() : null,
        submittedAt: image.createdAt.getTime(),
        inferenceResult: inferenceResult ? {
          id: inferenceResult.id,
          bboxTopLeftX: inferenceResult.bboxTopLeftX,
          bboxTopLeftY: inferenceResult.bboxTopLeftY,
          bboxWidth: inferenceResult.bboxWidth,
          bboxHeight: inferenceResult.bboxHeight,
          bboxConfidence: inferenceResult.bboxConfidence,
          bboxClassId: inferenceResult.bboxClassId,
          speciesProbabilities: JSON.parse(inferenceResult.speciesProbabilities),
          sexProbabilities: JSON.parse(inferenceResult.sexProbabilities),
          abdomenStatusProbabilities: JSON.parse(inferenceResult.abdomenStatusProbabilities)
        } : null,
        filemd5: image.filemd5
      });
    } catch (error) {
      return handleError(error, request, reply, 'Failed to get specimen image info');
    }
  } 
  