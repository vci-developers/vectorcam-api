import { FastifyRequest, FastifyReply } from 'fastify';
import { findDeviceById, hasAssociatedSessions } from './common';

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
        message: { type: 'string' }
      }
    }
  }
};

export async function deleteDevice(
  request: FastifyRequest<{ Params: { device_id: number } }>,
  reply: FastifyReply
) {
  try {
    const { device_id } = request.params;

    const device = await findDeviceById(device_id);
    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    const hasSessions = await hasAssociatedSessions(device_id);
    if (hasSessions) {
      return reply.code(400).send({
        error: 'Cannot delete device with associated sessions',
      });
    }

    await device.destroy();

    return reply.code(200).send({
      message: 'Device deleted successfully',
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 