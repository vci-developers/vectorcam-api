import { FastifyReply, FastifyRequest } from 'fastify';
import { DataRecovery } from '../../db/models';

export const schema = {
  tags: ['Data Recovery'],
  description: 'Delete a recovery record',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  },
};

export async function deleteDataRecovery(
  request: FastifyRequest<{ Params: { id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const record = await DataRecovery.findByPk(request.params.id);
    if (!record) {
      return reply.code(404).send({ error: 'Recovery record not found' });
    }

    await record.destroy();
    return reply.send({ message: 'Recovery record deleted' });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to delete recovery record' });
  }
}
