import { FastifyRequest, FastifyReply } from 'fastify';
import { Site } from '../../db/models';
import { formatSiteResponse, findProgramById } from './common';

interface CreateSiteRequest {
  programId: number;
  district?: string;
  subCounty?: string;
  parish?: string;
  sentinelSite?: string;
  healthCenter?: string;
}

export const schema = {
  body: {
    type: 'object',
    required: ['programId'],
    properties: {
      programId: { type: 'number' },
      district: { type: 'string' },
      subCounty: { type: 'string' },
      parish: { type: 'string' },
      sentinelSite: { type: 'string' },
      healthCenter: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        site: {
          type: 'object',
          properties: {
            siteId: { type: 'number' },
            programId: { type: 'number' },
            district: { type: 'string' },
            subCounty: { type: 'string' },
            parish: { type: 'string' },
            sentinelSite: { type: 'string' },
            healthCenter: { type: 'string' },
          },
        },
      },
    },
  },
};

export async function createSite(
  request: FastifyRequest<{ Body: CreateSiteRequest }>,
  reply: FastifyReply
) {
  try {
    const { programId, district, subCounty, parish, sentinelSite, healthCenter } = request.body;

    // Check if program exists
    const program = await findProgramById(programId);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const site = await Site.create({
      programId,
      district,
      subCounty,
      parish,
      sentinelSite,
      healthCenter,
    });

    return reply.code(200).send({
      message: 'Site created successfully',
      site: formatSiteResponse(site),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 