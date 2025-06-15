import { FastifyRequest, FastifyReply } from 'fastify';
import { findSiteById, formatSiteResponse, findProgramById } from './common';

interface UpdateSiteRequest {
  programId?: number;
  district?: string;
  subCounty?: string;
  parish?: string;
  sentinelSite?: string;
  healthCenter?: string;
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
      district: { type: 'string' },
      subCounty: { type: 'string' },
      parish: { type: 'string' },
      sentinelSite: { type: 'string' },
      healthCenter: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        site: {
          type: 'object',
          properties: {
            siteId: { type: 'number' },
            programId: { type: 'number' },
            district: { type: 'string' },
            subCounty: { type: 'string' },
            parish: { type: 'string' },
            sentinelSite: { type: 'string' },
            healthCenter: { type: 'string' },
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
  reply: FastifyReply
) {
  try {
    const { site_id } = request.params;
    const { programId, district, subCounty, parish, sentinelSite, healthCenter } = request.body;

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
      district: district !== undefined ? district : site.district,
      subCounty: subCounty !== undefined ? subCounty : site.subCounty,
      parish: parish !== undefined ? parish : site.parish,
      sentinelSite: sentinelSite !== undefined ? sentinelSite : site.sentinelSite,
      healthCenter: healthCenter !== undefined ? healthCenter : site.healthCenter,
    });

    return reply.code(200).send({
      message: 'Site updated successfully',
      site: formatSiteResponse(site),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 