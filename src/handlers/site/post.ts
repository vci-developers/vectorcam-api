import { FastifyRequest } from 'fastify';
import { Site } from '../../db/models';
import { formatSiteResponse, findProgramById } from './common';

interface CreateSiteRequest {
  programId: number;
  latitude?: number;
  longitude?: number;
  houseNumber?: number;
  villageName?: string;
}

export const schema = {
  body: {
    type: 'object',
    required: ['programId'],
    properties: {
      programId: { type: 'number' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      houseNumber: { type: 'number' },
      villageName: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        site: {
          type: 'object',
          properties: {
            siteId: { type: 'number' },
            programId: { type: 'number' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            houseNumber: { type: 'number' },
            villageName: { type: 'string' },
          },
        },
      },
    },
  },
};

export async function createSite(
  request: FastifyRequest<{ Body: CreateSiteRequest }>,
  reply: any
) {
  try {
    const { programId, latitude, longitude, houseNumber, villageName } = request.body;

    // Check if program exists
    const program = await findProgramById(programId);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const site = await Site.create({
      programId,
      latitude,
      longitude,
      houseNumber,
      villageName,
    });

    return reply.code(200).send({
      site: formatSiteResponse(site),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 