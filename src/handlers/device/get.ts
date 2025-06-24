import { FastifyRequest, FastifyReply } from 'fastify';
import { formatDeviceResponse } from './common';
import { Device, Program } from '../../db/models';

export const schema = {
  tags: ['Devices'],
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
        submittedAt: { type: 'number' },
        program: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' }
          }
        }
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

    const device = await Device.findByPk(device_id, {
      include: [
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    // Format response with associations
    const deviceData = device.get({ plain: true }) as any;
    const response = {
      ...formatDeviceResponse(device),
      program: deviceData.program ? {
        id: deviceData.program.id,
        name: deviceData.program.name
      } : null
    };

    return reply.code(200).send(response);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 