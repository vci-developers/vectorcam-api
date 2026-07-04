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
  description: 'Get collection cycles for a bounded date range',
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  querystring: {
    type: 'object',
    required: ['startDate', 'endDate'],
    properties: {
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
    const fromDate = parseDate(request.query.startDate);
    const toDate = parseDate(request.query.endDate);

    if (fromDate >= toDate) {
      throw new Error('fromDate must be before toDate');
    }

    const cycles = await CollectionCycle.findAll({
      where: {
        programId: request.params.program_id,
        startDate: { [Op.lt]: toDate },
        endDate: { [Op.gt]: fromDate },
      },
      order: [['startDate', 'ASC'], ['cycleNumber', 'ASC']],
    });

    return reply.code(200).send({
      collectionCycles: cycles.map(formatCollectionCycleResponse),
    });
  } catch (error) {
    return handleCollectionCycleError(error, request, reply);
  }
}
