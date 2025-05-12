import { FastifyRequest, FastifyReply } from 'fastify';
import { findDeviceById, findSiteById, formatDeviceResponse, handleError } from './common';

interface UpdateDeviceRequest {
  siteId?: number;
}

export const schema = {
  params: {
    type: 'object',
    properties: {
      device_id: { type: 'number' }
    }
  },
  body: {
    type: 'object',
    properties: {
      siteId: { type: 'number' },
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        device: {
          type: 'object',
          properties: {
            deviceId: { type: 'number' },
            siteId: { type: 'number' }
          }
        }
      }
    }
  }
};

export async function updateDevice(
  request: FastifyRequest<{ Params: { device_id: number }; Body: UpdateDeviceRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { device_id } = request.params;
    const { siteId } = request.body;

    const device = await findDeviceById(device_id);
    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    // If updating siteId, check if site exists
    if (siteId) {
      const site = await findSiteById(siteId);
      if (!site) {
        return reply.code(404).send({ error: 'Site not found' });
      }
    }

    // Update the device
    await device.update({
      siteId: siteId || device.siteId,
    });

    reply.send({
      message: 'Device updated successfully',
      device: formatDeviceResponse(device)
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to update device');
  }
} 