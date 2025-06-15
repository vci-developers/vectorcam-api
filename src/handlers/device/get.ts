import { FastifyRequest, FastifyReply } from 'fastify';
import { findDeviceById, formatDeviceResponse } from './common';

export const schema = {
  params: {
    type: 'object',
    required: ['device_id'],
    properties: {
      device_id: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        deviceId: { type: 'number' },
        model: { type: 'string' },
        registeredAt: { type: 'number' },
        programId: { type: 'number' },
      },
    },
  },
};

export async function getDeviceDetails(
  request: FastifyRequest<{ Params: { device_id: number } }>,
  reply: FastifyReply
) {
  try {
    const { device_id } = request.params;

    const device = await findDeviceById(device_id);
    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    return reply.code(200).send(formatDeviceResponse(device));
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 