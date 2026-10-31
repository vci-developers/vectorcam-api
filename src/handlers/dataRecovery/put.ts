import { FastifyReply, FastifyRequest } from 'fastify';
import { DataRecovery } from '../../db/models';
import { dataRecoverySchema, serializeDataRecovery } from './common';

interface UpdateDataRecoveryBody {
  status?: string;
  notes?: string | null;
}

export const schema = {
  tags: ['Data Recovery'],
  description: 'Update the status or notes on a recovery record. The payload is left unchanged.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'number' },
    },
  },
  body: {
    type: 'object',
    properties: {
      status: { type: 'string', minLength: 1, maxLength: 64 },
      notes: { type: ['string', 'null'], maxLength: 10000 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        dataRecovery: dataRecoverySchema,
      },
    },
  },
};

export async function updateDataRecovery(
  request: FastifyRequest<{ Params: { id: number }; Body: UpdateDataRecoveryBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const record = await DataRecovery.findByPk(request.params.id);
    if (!record) {
      return reply.code(404).send({ error: 'Recovery record not found' });
    }

    const updates: { status?: string; notes?: string | null } = {};
    if (request.body.status !== undefined) {
      const status = request.body.status.trim();
      if (!status) {
        return reply.code(400).send({ error: 'status is required' });
      }
      updates.status = status;
    }
    if (request.body.notes !== undefined) {
      updates.notes = request.body.notes;
    }
    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No updates provided' });
    }

    await record.update(updates);
    return reply.send({
      message: 'Recovery record updated',
      dataRecovery: serializeDataRecovery(record),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to update recovery record' });
  }
}
