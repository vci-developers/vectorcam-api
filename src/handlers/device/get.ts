import { FastifyRequest, FastifyReply } from 'fastify';
import { findDeviceById, formatDeviceResponse, handleError } from './common';

export const schema = {
  tags: ['Devices'],
  description: 'Get device details',
  params: {
    type: 'object',
    properties: {
      device_id: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        deviceId: { type: 'number' },
        siteId: { type: 'number' },
        name: { type: ['string', 'null'] },
        modelNumber: { type: ['string', 'null'] },
        serialNumber: { type: ['string', 'null'] },
        firmwareVersion: { type: ['string', 'null'] }
      }
    }
  }
};

export async function getDeviceDetails(
  request: FastifyRequest<{ Params: { device_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { device_id } = request.params;

    const device = await findDeviceById(device_id);
    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    reply.send(formatDeviceResponse(device));
  } catch (error) {
    handleError(error, request, reply, 'Failed to get device details');
  }
} 