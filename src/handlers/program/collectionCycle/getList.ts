import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { CollectionCycle } from '../../../db/models';
import {
  GetCollectionCyclesQuery,
  collectionCycleResponseSchema,
  formatCollectionCycleResponse,
  handleCollectionCycleError,
  parseDate,
} from './common';

export const schema = {
  tags: ['Collection Cycles'],
  description: 'Get collection cycles by ID or for a bounded date range',
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      id: { type: 'number' },
      startDate: {
        anyOf: [
          { type: 'number' },
          { type: 'string' },
        ],
      },
      endDate: {
        anyOf: [
          { type: 'number' },
          { type: 'string' },
        ],
      },
    },
    anyOf: [
      { required: ['id'] },
      { required: ['startDate', 'endDate'] },
    ],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        collectionCycles: {
          type: 'array',
          items: collectionCycleResponseSchema,
        },
      },
    },
  },
};

export async function getCollectionCycleList(
  request: FastifyRequest<{ Params: { program_id: number }; Querystring: GetCollectionCyclesQuery }>,
  reply: FastifyReply
) {
  try {
    const { id, startDate, endDate } = request.query;
    const where: Record<string | symbol, unknown> = {
      programId: request.params.program_id,
    };

    if (id !== undefined) {
      where.id = id;
    } else {
      const fromDate = parseDate(startDate!);
      const toDate = parseDate(endDate!);

      if (fromDate >= toDate) {
        throw new Error('startDate must be before endDate');
      }

      where.startDate = { [Op.lt]: toDate };
      where.endDate = { [Op.gt]: fromDate };
    }

    const cycles = await CollectionCycle.findAll({
      where,
      order: [['startDate', 'ASC'], ['cycleNumber', 'ASC']],
    });

    return reply.code(200).send({
      collectionCycles: cycles.map(formatCollectionCycleResponse),
    });
  } catch (error) {
    return handleCollectionCycleError(error, request, reply);
  }
}
