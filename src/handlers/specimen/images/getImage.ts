import { FastifyRequest, FastifyReply } from 'fastify';
import { getFileStream } from '../../../services/s3.service';
import { findSpecimen, handleError } from '../common';
import { SpecimenImage } from '../../../db/models';
import { InferenceResult } from '../../../db/models';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Get a specimen image',
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' },
      image_id: { type: 'string' }
    },
    required: ['specimen_id', 'image_id']
  }
  // No response schema as this returns a binary stream
};

export const infoSchema = {
  tags: ['Specimen Images'],
  description: 'Get specimen image metadata and inference result',
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
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
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

    // Check if image_id is a number (integer string)
    const isNumericId = /^\d+$/.test(image_id);

    let image: SpecimenImage | null = null;

    if (isNumericId) {
      // Try finding by id first
      image = await SpecimenImage.findOne({
        where: {
          id: parseInt(image_id, 10),
          specimenId: specimen.id
        }
      });
      // If not found by id, try by filemd5
      if (!image) {
        image = await SpecimenImage.findOne({
          where: {
            filemd5: image_id,
            specimenId: specimen.id
          }
        });
      }
    } else {
      // Try finding by filemd5 first
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
      return reply.code(404).send({ error: 'Image not found in storage' });
    }
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get specimen image');
  }
} 

export async function getImageInfo(
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