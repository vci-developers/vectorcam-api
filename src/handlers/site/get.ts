import { FastifyRequest, FastifyReply } from 'fastify';
import { findSiteById, formatSiteResponse, handleError } from './common';

export const schema = {
  tags: ['Sites'],
  description: 'Get site details',
  params: {
    type: 'object',
    properties: {
      site_id: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        siteId: { type: 'number' },
        programId: { type: 'number' },
        district: { type: ['string', 'null'] },
        subCounty: { type: ['string', 'null'] },
        parish: { type: ['string', 'null'] },
        sentinelSite: { type: ['string', 'null'] },
        healthCenter: { type: ['string', 'null'] }
      }
    }
  }
};

export async function getSiteDetails(
  request: FastifyRequest<{ Params: { site_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { site_id } = request.params;

    const site = await findSiteById(site_id);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    reply.send(formatSiteResponse(site));
  } catch (error) {
    handleError(error, request, reply, 'Failed to get site details');
  }
} 