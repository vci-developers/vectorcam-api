import { FastifyRequest, FastifyReply } from 'fastify';
import { findDeviceById, hasAssociatedSessions, handleError } from './common';

export const schema = {
  tags: ['Devices'],
  description: 'Delete a device',
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
        message: { type: 'string' }
      }
    }
  }
};

export async function deleteDevice(
  request: FastifyRequest<{ Params: { device_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { device_id } = request.params;

    const device = await findDeviceById(device_id);
    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    // Check if device has associated sessions
    const hasSessions = await hasAssociatedSessions(device_id);
    if (hasSessions) {
      return reply.code(400).send({ 
        error: 'Device cannot be deleted because it has associated sessions' 
      });
    }

    // Delete the device
    await device.destroy();

    reply.send({
      message: 'Device deleted successfully',
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to delete device');
  }
} 