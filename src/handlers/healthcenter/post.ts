import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  formatHealthCenterResponse, 
  handleError,
} from './common';
import { HealthCenter } from '../../db/models';

interface CreateHealthCenterRequest {
  latitude: number;
  longitude: number;
  parish: string;
  subcounty: string;
  district: string;
  country: string;
}

export const schema = {
  body: {
    type: 'object',
    required: ['latitude', 'longitude', 'parish', 'subcounty', 'district', 'country'],
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
    201: {
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

export async function createHealthCenter(
  request: FastifyRequest<{ Body: CreateHealthCenterRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { latitude, longitude, parish, subcounty, district, country } = request.body;

    // Create the health center
    const healthCenter = await HealthCenter.create({
      latitude,
      longitude,
      parish,
      subcounty,
      district,
      country
    });

    reply.code(201).send({
      message: 'Health center created successfully',
      healthCenter: formatHealthCenterResponse(healthCenter)
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to create health center');
  }
} 