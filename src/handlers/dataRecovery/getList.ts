import { FastifyReply, FastifyRequest } from 'fastify';
import { WhereOptions } from 'sequelize';
import { DataRecovery } from '../../db/models';
import { dataRecoverySummarySchema, parseOptionalInt, serializeDataRecoverySummary } from './common';

interface ListQuery {
  programId?: number;
  siteId?: number;
  year?: number;
  month?: number;
  status?: string;
  sessionFrontendId?: string;
  limit?: number;
  offset?: number;
}

export const schema = {
  tags: ['Data Recovery'],
  description: 'List recovery records. Payloads are omitted.',
  querystring: {
    type: 'object',
    properties: {
      programId: { type: 'number' },
      siteId: { type: 'number' },
      year: { type: 'number' },
      month: { type: 'number' },
      status: { type: 'string' },
      sessionFrontendId: { type: 'string' },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
      offset: { type: 'number', minimum: 0, default: 0 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        dataRecoveries: {
          type: 'array',
          items: dataRecoverySummarySchema,
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  },
};

export async function getDataRecoveryList(
  request: FastifyRequest<{ Querystring: ListQuery }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const programId = parseOptionalInt(request.query.programId, 'programId');
    if (programId.error) return reply.code(400).send({ error: programId.error });
    const siteId = parseOptionalInt(request.query.siteId, 'siteId');
    if (siteId.error) return reply.code(400).send({ error: siteId.error });
    const year = parseOptionalInt(request.query.year, 'year');
    if (year.error) return reply.code(400).send({ error: year.error });
    const month = parseOptionalInt(request.query.month, 'month', { min: 1, max: 12 });
    if (month.error) return reply.code(400).send({ error: month.error });

    const limit = request.query.limit ?? 50;
    const offset = request.query.offset ?? 0;
    const where: WhereOptions = {};
    if (programId.value !== undefined) where.programId = programId.value;
    if (siteId.value !== undefined) where.siteId = siteId.value;
    if (year.value !== undefined) where.year = year.value;
    if (month.value !== undefined) where.month = month.value;
    if (request.query.status) where.status = request.query.status;
    if (request.query.sessionFrontendId) where.sessionFrontendId = request.query.sessionFrontendId;

    const { rows, count } = await DataRecovery.findAndCountAll({
      where,
      attributes: { exclude: ['payload'] },
      order: [['id', 'DESC']],
      limit,
      offset,
    });

    return reply.send({
      dataRecoveries: rows.map(serializeDataRecoverySummary),
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to list recovery records' });
  }
}
