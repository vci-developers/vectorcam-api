import { FastifyRequest, FastifyReply } from 'fastify';
import { formatSiteResponse, handleError } from './common';
import { Site, Program } from '../../db/models';

export const schema = {
  tags: ['Sites'],
  description: 'Get site details',
  params: {
    type: 'object',
    properties: {
      site_id: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        siteId: { type: 'number' },
        programId: { type: 'number' },
        locationTypeId: { type: ['number', 'null'] },
        parentId: { type: ['number', 'null'] },
        name: { type: 'string' },
        district: { type: ['string', 'null'] },
        subCounty: { type: ['string', 'null'] },
        parish: { type: ['string', 'null'] },
        villageName: { type: ['string', 'null'] },
        houseNumber: { type: 'string' },
        isActive: { type: 'boolean' },
        hasData: { type: 'boolean' },
        healthCenter: { type: ['string', 'null'] },
        program: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            country: { type: 'string' }
          }
        },
        locationHierarchy: {
          type: 'object',
          additionalProperties: { type: 'string' }
        },
      }
    }
  }
};

export async function getSiteDetails(
  request: FastifyRequest<{ Params: { site_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { site_id } = request.params;

    const site = await Site.findByPk(site_id, {
      include: [
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'name', 'country']
        }
      ]
    });

    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    // Format response with associations
    const siteData = site.get({ plain: true }) as any;
    const sitePayload = await formatSiteResponse(site);
    const response = {
      ...sitePayload,
      program: siteData.program
        ? {
            id: siteData.program.id,
            name: siteData.program.name,
            country: siteData.program.country,
          }
        : null,
    };

    return reply.send(response);
  } catch (error) {
    return handleError(error, request, reply, 'Failed to get site details');
  }
} 