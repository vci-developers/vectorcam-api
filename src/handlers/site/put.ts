import { FastifyRequest } from 'fastify';
import { formatSiteResponse, findSiteById, findProgramById } from './common';

interface UpdateSiteRequest {
  programId?: number;
  latitude?: number;
  longitude?: number;
  houseNumber?: number;
  villageName?: string;
}

export const schema = {
  params: {
    type: 'object',
    required: ['site_id'],
    properties: {
      site_id: { type: 'number' }
    }
  },
  body: {
    type: 'object',
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

export async function updateSite(
  request: FastifyRequest<{ 
    Params: { site_id: number };
    Body: UpdateSiteRequest;
  }>,
  reply: any
) {
  try {
    const { site_id } = request.params;
    const { programId, latitude, longitude, houseNumber, villageName } = request.body;

    const site = await findSiteById(site_id);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    if (programId) {
      const program = await findProgramById(programId);
      if (!program) {
        return reply.code(404).send({ error: 'Program not found' });
      }
    }

    await site.update({
      programId: programId !== undefined ? programId : site.programId,
      latitude: latitude !== undefined ? latitude : site.latitude,
      longitude: longitude !== undefined ? longitude : site.longitude,
      houseNumber: houseNumber !== undefined ? houseNumber : site.houseNumber,
      villageName: villageName !== undefined ? villageName : site.villageName,
    });

    return reply.code(200).send({
      site: formatSiteResponse(site),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 