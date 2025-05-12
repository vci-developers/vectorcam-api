import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { 
  findSpecimen, 
  formatSpecimenResponse, 
  handleError, 
  findYoloBoxById 
} from './common';
import { Specimen, YoloBox, SpecimenImage } from '../../db/models';

interface UpdateSpecimenRequest {
  specimenId?: string;
  species?: string;
  sex?: string;
  abdomenStatus?: string;
  thumbnailImageId?: number;
  yoloBox?: {
    topLeftX: number;
    topLeftY: number;
    width: number;
    height: number;
  };
}

export const schema = {
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
      thumbnailImageId: { type: 'number' },
      yoloBox: {
        type: 'object',
        properties: {
          topLeftX: { type: 'number' },
          topLeftY: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' }
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
            yoloBox: {
              type: ['object', 'null'],
              properties: {
                yoloBoxId: { type: 'number' },
                topLeftX: { type: 'number' },
                topLeftY: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' }
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
    const { specimenId, species, sex, abdomenStatus, thumbnailImageId, yoloBox } = request.body;
    
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

    // Update the yoloBox if provided
    let yoloBoxData = null;
    if (yoloBox && specimen.yoloBoxId) {
      const existingBox = await findYoloBoxById(specimen.yoloBoxId);
      if (existingBox) {
        await existingBox.update({
          topLeftX: yoloBox.topLeftX,
          topLeftY: yoloBox.topLeftY,
          width: yoloBox.width,
          height: yoloBox.height,
        });
        yoloBoxData = existingBox;
      }
    } else if (yoloBox) {
      // Create a new yoloBox if specimen doesn't have one
      const newBox = await YoloBox.create({
        topLeftX: yoloBox.topLeftX,
        topLeftY: yoloBox.topLeftY,
        width: yoloBox.width,
        height: yoloBox.height,
      });
      await specimen.update({ yoloBoxId: newBox.id });
      yoloBoxData = newBox;
    }

    // Update the specimen with the new data
    await specimen.update({
      specimenId: specimenId !== undefined ? specimenId : specimen.specimenId,
      species: species !== undefined ? species : specimen.species,
      sex: sex !== undefined ? sex : specimen.sex,
      abdomenStatus: abdomenStatus !== undefined ? abdomenStatus : specimen.abdomenStatus,
      thumbnailImageId: thumbnailImageId !== undefined ? thumbnailImageId : specimen.thumbnailImageId,
      yoloBoxId: yoloBoxData ? yoloBoxData.id : specimen.yoloBoxId
    });

    // Get the updated specimen
    const updatedSpecimen = await specimen.reload();
    if (!updatedSpecimen) {
      return reply.code(500).send({ error: 'Failed to update specimen' });
    }

    const response = await formatSpecimenResponse(updatedSpecimen);
    reply.send({
      message: 'Specimen updated successfully',
      specimen: response
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to update specimen');
  }
} 