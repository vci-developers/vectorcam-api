import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findSessionById, 
  handleError, 
  formatSpecimenResponse,
} from './common';
import { YoloBox, Specimen } from '../../db/models';

interface CreateSpecimenRequest {
  specimenId: string;
  sessionId: number;
  species?: string;
  sex?: string;
  abdomenStatus?: string;
  yoloBox?: {
    topLeftX: number;
    topLeftY: number;
    width: number;
    height: number;
  };
}

export const schema = {
  tags: ['Specimens'],
  description: 'Create a new specimen',
  body: {
    type: 'object',
    required: ['sessionId', 'specimenId'],
    properties: {
      specimenId: { type: 'string' },
      sessionId: { type: 'number' },
      species: { type: 'string' },
      sex: { type: 'string' },
      abdomenStatus: { type: 'string' },
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
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        specimen: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            specimenId: { type: 'string' },
            sessionId: { type: 'number' },
            imageUrl: { type: ['string', 'null'] },
            species: { type: ['string', 'null'] },
            sex: { type: ['string', 'null'] },
            abdomenStatus: { type: ['string', 'null'] },
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

export async function createSpecimen(
  request: FastifyRequest<{ Body: CreateSpecimenRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const {
      specimenId,
      sessionId,
      species,
      sex,
      abdomenStatus,
      yoloBox,
    } = request.body;

    // Check if session exists
    const session = await findSessionById(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    let createdYoloBox = null;
    if (yoloBox) {
      createdYoloBox = await YoloBox.create({
        topLeftX: yoloBox.topLeftX,
        topLeftY: yoloBox.topLeftY,
        width: yoloBox.width,
        height: yoloBox.height
      });
    }

    // Create the specimen
    const specimen = await Specimen.create({
      specimenId,
      sessionId,
      species,
      sex,
      abdomenStatus,
      yoloBoxId: createdYoloBox?.id
    });

    const formattedResponse = await formatSpecimenResponse(specimen);

    reply.code(201).send({
      message: 'Specimen created successfully',
      specimen: formattedResponse
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to create specimen');
  }
} 