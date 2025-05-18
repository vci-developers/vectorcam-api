import { FastifyRequest, FastifyReply } from 'fastify';
import { findHealthCenterById, formatHealthCenterResponse, handleError } from './common';

export const schema = {
  tags: ['Health Centers'],
  description: 'Get health center details',
  params: {
    type: 'object',
    properties: {
      healthcenter_id: { type: 'number' }
    }
  },
  response: {
    200: {
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
};

export async function getHealthCenterDetails(
  request: FastifyRequest<{ Params: { healthcenter_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { healthcenter_id } = request.params;

    const healthCenter = await findHealthCenterById(healthcenter_id);
    if (!healthCenter) {
      return reply.code(404).send({ error: 'Health center not found' });
    }

    reply.send(formatHealthCenterResponse(healthCenter));
  } catch (error) {
    handleError(error, request, reply, 'Failed to get health center details');
  }
} 