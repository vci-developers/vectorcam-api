import { FastifyRequest, FastifyReply } from 'fastify';
import { findSiteById, formatDeviceResponse, handleError } from './common';
import { Device } from '../../db/models';

interface RegisterDeviceRequest {
  siteId: number;
}

export const schema = {
  body: {
    type: 'object',
    required: ['siteId'],
    properties: {
      siteId: { type: 'number' },
    }
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        device: {
          type: 'object',
          properties: {
            deviceId: { type: 'number' },
            siteId: { type: 'number' },
          }
        }
      }
    }
  }
};

export async function createDevice(
  request: FastifyRequest<{ Body: RegisterDeviceRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { siteId } = request.body;

    // Check if site exists
    const site = await findSiteById(siteId);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    // Create the device
    const device = await Device.create({
      siteId,
    });

    reply.code(201).send({
      message: 'Device registered successfully',
      device: formatDeviceResponse(device)
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to register device');
  }
} 