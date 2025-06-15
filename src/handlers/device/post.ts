import { FastifyRequest, FastifyReply } from 'fastify';
import { Device } from '../../db/models';
import { formatDeviceResponse, findProgramById } from './common';

interface CreateDeviceRequest {
  model: string;
  registeredAt: number; // Unix timestamp in milliseconds
  programId: number;
}

export const schema = {
  body: {
    type: 'object',
    required: ['model', 'registeredAt', 'programId'],
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

export async function createDevice(
  request: FastifyRequest<{ Body: CreateDeviceRequest }>,
  reply: FastifyReply
) {
  try {
    const { model, registeredAt, programId } = request.body;

    // Check if program exists
    const program = await findProgramById(programId);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const device = await Device.create({
      model,
      registeredAt: new Date(registeredAt),
      programId,
    });

    return reply.code(200).send({
      message: 'Device created successfully',
      device: formatDeviceResponse(device),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 