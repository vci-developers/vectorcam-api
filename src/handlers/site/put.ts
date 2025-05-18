import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findSiteById, 
  formatSiteResponse, 
  handleError, 
  findHealthCenterById
} from './common';

interface UpdateSiteRequest {
  healthCenterId?: number;
  latitude?: number;
  longitude?: number;
  houseNumber?: number;
  villageName?: string;
}

export const schema = {
  tags: ['Sites'],
  description: 'Update site details',
  params: {
    type: 'object',
    properties: {
      site_id: { type: 'number' }
    }
  },
  body: {
    type: 'object',
    properties: {
      healthCenterId: { type: 'number' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      houseNumber: { type: 'number' },
      villageName: { type: 'string' }
    }
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
            healthCenterId: { type: 'number' },
            latitude: { type: ['number', 'null'] },
            longitude: { type: ['number', 'null'] },
            houseNumber: { type: ['number', 'null'] },
            villageName: { type: ['string', 'null'] }
          }
        }
      }
    }
  }
};

export async function updateSite(
  request: FastifyRequest<{ Params: { site_id: number }; Body: UpdateSiteRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { site_id } = request.params;
    const { healthCenterId, latitude, longitude, houseNumber, villageName } = request.body;

    const site = await findSiteById(site_id);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    // If updating health center, check if it exists
    if (healthCenterId) {
      const healthCenter = await findHealthCenterById(healthCenterId);
      if (!healthCenter) {
        return reply.code(404).send({ error: 'Health center not found' });
      }
    }

    // Update the site
    await site.update({
      healthCenterId: healthCenterId !== undefined ? healthCenterId : site.healthCenterId,
      latitude: latitude !== undefined ? latitude : site.latitude,
      longitude: longitude !== undefined ? longitude : site.longitude,
      houseNumber: houseNumber !== undefined ? houseNumber : site.houseNumber,
      villageName: villageName !== undefined ? villageName : site.villageName
    });

    reply.send({
      message: 'Site updated successfully',
      site: formatSiteResponse(site)
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to update site');
  }
} 