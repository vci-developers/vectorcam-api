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
  species?: string;
  sex?: string;
  abdomenStatus?: string;
  capturedAt?: number;
  thumbnailImageId?: number;
  inferenceResult?: {
    bboxTopLeftX: number;
    bboxTopLeftY: number;
    bboxWidth: number;
    bboxHeight: number;
    speciesProbabilities: number[];
    sexProbabilities: number[];
    abdomenStatusProbabilities: number[];
  };
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
      species: { type: 'string' },
      sex: { type: 'string' },
      abdomenStatus: { type: 'string' },
      capturedAt: { type: 'number' },
      thumbnailImageId: { type: 'number' },
      inferenceResult: {
        type: 'object',
        properties: {
          bboxTopLeftX: { type: 'number' },
          bboxTopLeftY: { type: 'number' },
          bboxWidth: { type: 'number' },
          bboxHeight: { type: 'number' },
          speciesProbabilities: { 
            type: 'array',
            items: { type: 'number' }
          },
          sexProbabilities: { 
            type: 'array',
            items: { type: 'number' }
          },
          abdomenStatusProbabilities: { 
            type: 'array',
            items: { type: 'number' }
          }
        }
      }
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
            species: { type: ['string', 'null'] },
            sex: { type: ['string', 'null'] },
            abdomenStatus: { type: ['string', 'null'] },
            capturedAt: { type: ['number', 'null'] },
            thumbnailUrl: { type: ['string', 'null'] },
            thumbnailImageId: { type: ['number', 'null'] },
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
            submittedAt: { type: 'number' },
            inferenceResult: {
              type: ['object', 'null'],
              properties: {
                id: { type: 'number' },
                bboxTopLeftX: { type: 'number' },
                bboxTopLeftY: { type: 'number' },
                bboxWidth: { type: 'number' },
                bboxHeight: { type: 'number' },
                speciesProbabilities: { 
                  type: 'array',
                  items: { type: 'number' }
                },
                sexProbabilities: { 
                  type: 'array',
                  items: { type: 'number' }
                },
                abdomenStatusProbabilities: { 
                  type: 'array',
                  items: { type: 'number' }
                }
              }
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
    const { specimenId, species, sex, abdomenStatus, capturedAt, thumbnailImageId, inferenceResult } = request.body;
    
    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // If changing specimenId, check if new id already exists
    if (specimenId && specimenId !== specimen.specimenId) {
      const idExists = await Specimen.findOne({
        where: { 
          specimenId,
          id: { [Op.ne]: specimen.id } // Not the current specimen
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

    // Update the inference result if provided
    if (inferenceResult) {
      const existingResult = await findInferenceResultBySpecimenId(specimen.id);
      if (existingResult) {
        await existingResult.update({
          bboxTopLeftX: inferenceResult.bboxTopLeftX,
          bboxTopLeftY: inferenceResult.bboxTopLeftY,
          bboxWidth: inferenceResult.bboxWidth,
          bboxHeight: inferenceResult.bboxHeight,
          speciesProbabilities: JSON.stringify(inferenceResult.speciesProbabilities),
          sexProbabilities: JSON.stringify(inferenceResult.sexProbabilities),
          abdomenStatusProbabilities: JSON.stringify(inferenceResult.abdomenStatusProbabilities)
        });
      } else {
        // Create a new inference result if specimen doesn't have one
        await InferenceResult.create({
          specimenId: specimen.id,
          bboxTopLeftX: inferenceResult.bboxTopLeftX,
          bboxTopLeftY: inferenceResult.bboxTopLeftY,
          bboxWidth: inferenceResult.bboxWidth,
          bboxHeight: inferenceResult.bboxHeight,
          speciesProbabilities: JSON.stringify(inferenceResult.speciesProbabilities),
          sexProbabilities: JSON.stringify(inferenceResult.sexProbabilities),
          abdomenStatusProbabilities: JSON.stringify(inferenceResult.abdomenStatusProbabilities)
        });
      }
    }

    // Update the specimen with the new data
    await specimen.update({
      specimenId: specimenId !== undefined ? specimenId : specimen.specimenId,
      species: species !== undefined ? species : specimen.species,
      sex: sex !== undefined ? sex : specimen.sex,
      abdomenStatus: abdomenStatus !== undefined ? abdomenStatus : specimen.abdomenStatus,
      capturedAt: capturedAt !== undefined ? new Date(capturedAt) : specimen.capturedAt,
      thumbnailImageId: thumbnailImageId !== undefined ? thumbnailImageId : specimen.thumbnailImageId
    });

    // Get the updated specimen
    const updatedSpecimen = await specimen.reload();
    if (!updatedSpecimen) {
      return reply.code(500).send({ error: 'Failed to update specimen' });
    }

    const response = await formatSpecimenResponse(updatedSpecimen);
    return reply.send({
      message: 'Specimen updated successfully',
      specimen: response
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to update specimen');
  }
} 