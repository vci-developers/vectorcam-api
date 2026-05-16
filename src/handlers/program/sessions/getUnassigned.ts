import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { Session, Site } from '../../../db/models';
import { formatSessionResponse } from '../../session/common';
import { expandSiteIdsWithDescendants } from '../../site/common';

interface QueryParams {
  limit?: number;
  offset?: number;
}

export const schema = {
  tags: ['Collection Cycles'],
  description: 'Get sessions in a program that are not assigned to a collection cycle',
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
      limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
      offset: { type: 'number', minimum: 0, default: 0 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sessionId: { type: 'number' },
              frontendId: { type: 'string' },
              collectionDate: { type: ['number', 'null'] },
              collectionCycleId: { type: ['number', 'null'] },
              siteId: { type: 'number' },
              deviceId: { type: 'number' },
            },
          },
        },
        total: { type: 'number' },
        limit: { type: 'number' },
        offset: { type: 'number' },
        hasMore: { type: 'boolean' },
      },
    },
  },
};

export async function getUnassignedProgramSessions(
  request: FastifyRequest<{ Params: { program_id: number }; Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    const { program_id } = request.params;
    const { limit = 20, offset = 0 } = request.query;
    const accessibleSiteIds = await expandSiteIdsWithDescendants(request.siteAccess?.userSites ?? []);

    const siteWhere: any = { programId: program_id };
    if (accessibleSiteIds.length > 0) {
      siteWhere.id = { [Op.in]: accessibleSiteIds };
    }

    const siteIds = (await Site.findAll({
      where: siteWhere,
      attributes: ['id'],
    })).map((site) => site.id);

    if (siteIds.length === 0) {
      return reply.code(200).send({
        sessions: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      });
    }

    const where = {
      siteId: { [Op.in]: siteIds },
      collectionCycleId: null,
    };

    const [total, sessions] = await Promise.all([
      Session.count({ where }),
      Session.findAll({
        where,
        order: [['collectionDate', 'ASC'], ['id', 'ASC']],
        limit,
        offset,
      }),
    ]);

    return reply.code(200).send({
      sessions: sessions.map(formatSessionResponse),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
