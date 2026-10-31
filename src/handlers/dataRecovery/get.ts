import { FastifyReply, FastifyRequest } from 'fastify';
import { DataRecovery } from '../../db/models';
import { dataRecoverySchema, serializeDataRecovery } from './common';

export const schema = {
  tags: ['Data Recovery'],
  description: 'Get one recovery record, including its payload',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'number' },
    },
  },
  response: {
    200: dataRecoverySchema,
  },
};

export async function getDataRecovery(
  request: FastifyRequest<{ Params: { id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const record = await DataRecovery.findByPk(request.params.id);
    if (!record) {
      return reply.code(404).send({ error: 'Recovery record not found' });
    }
    return reply.send(serializeDataRecovery(record));
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to get recovery record' });
  }
}
