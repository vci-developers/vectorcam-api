import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findHealthCenterById, 
  formatSiteResponse, 
  handleError
} from './common';
import { Site } from '../../db/models';
interface CreateSiteRequest {
  healthCenterId: number;
  latitude?: number;
  longitude?: number;
  houseNumber?: number;
  villageName?: string;
}

export const schema = {
  tags: ['Sites'],
  description: 'Register a new site',
  body: {
    type: 'object',
    required: ['healthCenterId'],
    properties: {
      healthCenterId: { type: 'number' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      houseNumber: { type: 'number' },
      villageName: { type: 'string' }
    }
  },
  response: {
    201: {
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

export async function createSite(
  request: FastifyRequest<{ Body: CreateSiteRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { healthCenterId, latitude, longitude, houseNumber, villageName } = request.body;

    // Check if health center exists
    const healthCenter = await findHealthCenterById(healthCenterId);
    if (!healthCenter) {
      return reply.code(404).send({ error: 'Health center not found' });
    }

    // Create the site
    const site = await Site.create({
      healthCenterId,
      latitude,
      longitude,
      houseNumber,
      villageName
    });

    reply.code(201).send({
      message: 'Site created successfully',
      site: formatSiteResponse(site)
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to create site');
  }
} 