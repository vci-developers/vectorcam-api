import { FastifyReply, FastifyRequest } from 'fastify';
import { UniqueConstraintError } from 'sequelize';
import { DataRecovery } from '../../db/models';
import { dataRecoverySchema, parseOptionalInt, serializeDataRecovery } from './common';

interface CreateDataRecoveryBody {
  idempotencyKey: string;
  payload: unknown;
  programId?: number | null;
  siteId?: number | null;
  sessionFrontendId?: string | null;
  year?: number | null;
  month?: number | null;
  status?: string;
  notes?: string | null;
}

export const schema = {
  tags: ['Data Recovery'],
  description: 'Store an unstructured recovery payload. Correlation fields are optional and are not validated against other tables.',
  body: {
    type: 'object',
    required: ['idempotencyKey', 'payload'],
    properties: {
      idempotencyKey: { type: 'string', minLength: 1, maxLength: 255 },
      payload: {},
      programId: { type: ['number', 'null'] },
      siteId: { type: ['number', 'null'] },
      sessionFrontendId: { type: ['string', 'null'], maxLength: 255 },
      year: { type: ['number', 'null'] },
      month: { type: ['number', 'null'] },
      status: { type: 'string', minLength: 1, maxLength: 64 },
      notes: { type: ['string', 'null'], maxLength: 10000 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        duplicate: { type: 'boolean' },
        dataRecovery: dataRecoverySchema,
      },
    },
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        duplicate: { type: 'boolean' },
        dataRecovery: dataRecoverySchema,
      },
    },
  },
};

export async function createDataRecovery(
  request: FastifyRequest<{ Body: CreateDataRecoveryBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const idempotencyKey = request.body.idempotencyKey?.trim();
    if (!idempotencyKey) {
      return reply.code(400).send({ error: 'idempotencyKey is required' });
    }
    if (request.body.payload === undefined || request.body.payload === null) {
      return reply.code(400).send({ error: 'payload is required' });
    }

    const programId = parseOptionalInt(request.body.programId, 'programId');
    if (programId.error) return reply.code(400).send({ error: programId.error });
    const siteId = parseOptionalInt(request.body.siteId, 'siteId');
    if (siteId.error) return reply.code(400).send({ error: siteId.error });
    const year = parseOptionalInt(request.body.year, 'year');
    if (year.error) return reply.code(400).send({ error: year.error });
    const month = parseOptionalInt(request.body.month, 'month', { min: 1, max: 12 });
    if (month.error) return reply.code(400).send({ error: month.error });

    const sessionFrontendId = request.body.sessionFrontendId?.trim() || null;
    const status = request.body.status?.trim() || 'pending';

    const record = await DataRecovery.create({
      idempotencyKey,
      payload: request.body.payload,
      programId: programId.value ?? null,
      siteId: siteId.value ?? null,
      sessionFrontendId,
      year: year.value ?? null,
      month: month.value ?? null,
      status,
      notes: request.body.notes ?? null,
    });

    return reply.code(201).send({
      message: 'Recovery record stored',
      duplicate: false,
      dataRecovery: serializeDataRecovery(record),
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      const existing = await DataRecovery.findOne({
        where: { idempotencyKey: request.body.idempotencyKey.trim() },
      });
      if (existing) {
        return reply.code(200).send({
          message: 'Recovery record already stored',
          duplicate: true,
          dataRecovery: serializeDataRecovery(existing),
        });
      }
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to store recovery record' });
  }
}
