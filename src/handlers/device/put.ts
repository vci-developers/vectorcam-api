import { FastifyRequest, FastifyReply } from 'fastify';
import { formatDeviceResponse, findDeviceById, findProgramById } from './common';

interface UpdateDeviceRequest {
  model?: string;
  registeredAt?: number; // Unix timestamp in milliseconds
  programId?: number;
}

export const schema = {
  params: {
    type: 'object',
    required: ['device_id'],
    properties: {
      device_id: { type: 'number' }
    }
  },
  body: {
    type: 'object',
    properties: {
      model: { type: 'string' },
      registeredAt: { type: 'number' }, // Unix timestamp in milliseconds
      programId: { type: 'number' },
    },
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
            model: { type: 'string' },
            registeredAt: { type: 'number' }, // Unix timestamp in milliseconds
            programId: { type: 'number' },
          },
        },
      },
    },
  },
};

export async function updateDevice(
  request: FastifyRequest<{ 
    Params: { device_id: number };
    Body: UpdateDeviceRequest;
  }>,
  reply: FastifyReply
) {
  try {
    const { device_id } = request.params;
    const { model, registeredAt, programId } = request.body;

    const device = await findDeviceById(device_id);
    if (!device) {
      return reply.code(404).send({ error: 'Device not found' });
    }

    if (programId) {
      const program = await findProgramById(programId);
      if (!program) {
        return reply.code(404).send({ error: 'Program not found' });
      }
    }

    await device.update({
      model: model !== undefined ? model : device.model,
      registeredAt: registeredAt !== undefined ? new Date(registeredAt) : device.registeredAt,
      programId: programId !== undefined ? programId : device.programId,
    });

    return reply.code(200).send({
      message: 'Device updated successfully',
      device: formatDeviceResponse(device),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 