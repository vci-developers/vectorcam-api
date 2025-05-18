import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findHealthCenterById, 
  formatHealthCenterResponse, 
  handleError
} from './common';

interface UpdateHealthCenterRequest {
  latitude?: number;
  longitude?: number;
  parish?: string;
  subcounty?: string;
  district?: string;
  country?: string;
}

export const schema = {
  tags: ['Health Centers'],
  description: 'Update health center details',
  params: {
    type: 'object',
    properties: {
      healthcenter_id: { type: 'number' }
    }
  },
  body: {
    type: 'object',
    properties: {
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      parish: { type: 'string' },
      subcounty: { type: 'string' },
      district: { type: 'string' },
      country: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        healthCenter: {
          type: 'object',
          properties: {
            healthCenterId: { type: 'number' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            parish: { type: 'string' },
            subcounty: { type: 'string' },
            district: { type: 'string' },
            country: { type: 'string' }
          }
        }
      }
    }
  }
};

export async function updateHealthCenter(
  request: FastifyRequest<{ Params: { healthcenter_id: number }; Body: UpdateHealthCenterRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { healthcenter_id } = request.params;
    const { latitude, longitude, parish, subcounty, district, country } = request.body;

    const healthCenter = await findHealthCenterById(healthcenter_id);
    if (!healthCenter) {
      return reply.code(404).send({ error: 'Health center not found' });
    }

    // Update the health center
    await healthCenter.update({
      latitude: latitude !== undefined ? latitude : healthCenter.latitude,
      longitude: longitude !== undefined ? longitude : healthCenter.longitude,
      parish: parish !== undefined ? parish : healthCenter.parish,
      subcounty: subcounty !== undefined ? subcounty : healthCenter.subcounty,
      district: district !== undefined ? district : healthCenter.district,
      country: country !== undefined ? country : healthCenter.country
    });

    reply.send({
      message: 'Health center updated successfully',
      healthCenter: formatHealthCenterResponse(healthCenter)
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to update health center');
  }
} 