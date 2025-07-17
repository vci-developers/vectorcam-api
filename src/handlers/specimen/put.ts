import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { 
  findSpecimen, 
  formatSpecimenResponse, 
  handleError, 
  findInferenceResultBySpecimenId 
} from './common';
import { Specimen, InferenceResult, SpecimenImage } from '../../db/models';

interface UpdateSpecimenRequest {
  specimenId?: string;
  thumbnailImageId?: number;
}

export const schema = {
  tags: ['Specimens'],
  description: 'Update specimen details',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' }
    }
  },
  body: {
    type: 'object',
    properties: {
      specimenId: { type: 'string' },
      thumbnailImageId: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        specimen: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            specimenId: { type: 'string' },
            sessionId: { type: 'number' },
            thumbnailUrl: { type: ['string', 'null'] },
            thumbnailImageId: { type: ['number', 'null'] },
            thumbnailImage: {
              anyOf: [
                { type: 'null' },
                {
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
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }
  }
};

export async function updateSpecimen(
  request: FastifyRequest<{ Params: { specimen_id: string }; Body: UpdateSpecimenRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;
    const { specimenId, thumbnailImageId } = request.body;
    
    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // If changing specimenId, check if new id already exists
    if (specimenId && specimenId !== specimen.specimenId) {
      const idExists = await Specimen.findOne({
        where: { 
          specimenId,
          id: { [Op.ne]: specimen.id }
        }
      });
      if (idExists) {
        return reply.code(409).send({ error: 'A specimen with this id already exists' });
      }
    }

    // Check if thumbnailImageId is valid
    if (thumbnailImageId !== undefined) {
      const imageExists = await SpecimenImage.findOne({
        where: {
          id: thumbnailImageId,
          specimenId: specimen.id
        }
      });
      if (!imageExists) {
        return reply.code(400).send({ error: 'The specified image does not exist or does not belong to this specimen' });
      }
    }

    // Update the specimen with the new data
    await specimen.update({
      specimenId: specimenId !== undefined ? specimenId : specimen.specimenId,
      thumbnailImageId: thumbnailImageId !== undefined ? thumbnailImageId : specimen.thumbnailImageId
    });

    // Get the updated specimen
    const updatedSpecimen = await specimen.reload();
    if (!updatedSpecimen) {
      return reply.code(500).send({ error: 'Failed to update specimen' });
    }

    const response = await formatSpecimenResponse(updatedSpecimen, false);
    return reply.send({
      message: 'Specimen updated successfully',
      specimen: response
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to update specimen');
  }
} 