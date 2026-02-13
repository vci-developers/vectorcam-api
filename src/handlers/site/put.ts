import { FastifyRequest, FastifyReply } from 'fastify';
import { findSiteById, formatSiteResponse, findProgramById, rebuildLocationHierarchy } from './common';

interface UpdateSiteRequest {
  programId?: number;
  locationTypeId?: number | null;
  parentId?: number | null;
  name?: string | null;
  district?: string;
  subCounty?: string;
  parish?: string;
  villageName?: string;
  houseNumber?: string;
  isActive?: boolean;
  healthCenter?: string;
}

export const schema = {
  tags: ['Sites'],
  params: {
    type: 'object',
    required: ['site_id'],
    properties: {
      site_id: { type: 'number' }
    }
  },
  body: {
    type: 'object',
    properties: {
      programId: { type: 'number' },
      locationTypeId: { type: ['number', 'null'] },
      parentId: { type: ['number', 'null'] },
      name: { type: ['string', 'null'] },
      district: { type: 'string' },
      subCounty: { type: 'string' },
      parish: { type: 'string' },
      villageName: { type: 'string' },
      houseNumber: { type: 'string' },
      isActive: { type: 'boolean' },
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
            locationTypeId: { type: ['number', 'null'] },
            parentId: { type: ['number', 'null'] },
            name: { type: 'string' },
            district: { type: 'string' },
            subCounty: { type: 'string' },
            parish: { type: 'string' },
            villageName: { type: 'string' },
            houseNumber: { type: 'string' },
            isActive: { type: 'boolean' },
            hasData: { type: 'boolean' },
            healthCenter: { type: 'string' },
            locationHierarchy: {
              type: 'object',
              additionalProperties: { type: 'string' }
            },
          },
        },
      },
    },
  },
};

export async function updateSite(
  request: FastifyRequest<{ 
    Params: { site_id: number };
    Body: UpdateSiteRequest;
  }>,
  reply: FastifyReply
) {
  try {
    const { site_id } = request.params;
    const { programId, locationTypeId, parentId, name, district, subCounty, parish, villageName, houseNumber, isActive, healthCenter } = request.body;

    const site = await findSiteById(site_id);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    if (programId) {
      const program = await findProgramById(programId);
      if (!program) {
        return reply.code(404).send({ error: 'Program not found' });
      }
    }

    await site.update({
      programId: programId !== undefined ? programId : site.programId,
      locationTypeId: locationTypeId !== undefined ? locationTypeId : site.locationTypeId,
      parentId: parentId !== undefined ? parentId : site.parentId,
      name: name !== undefined ? name : site.name,
      district: district !== undefined ? district : site.district,
      subCounty: subCounty !== undefined ? subCounty : site.subCounty,
      parish: parish !== undefined ? parish : site.parish,
      villageName: villageName !== undefined ? villageName : site.villageName,
      houseNumber: houseNumber !== undefined ? houseNumber : site.houseNumber,
      isActive: isActive !== undefined ? isActive : site.isActive,
      healthCenter: healthCenter !== undefined ? healthCenter : site.healthCenter,
    });

    const hydratedSite = await rebuildLocationHierarchy(site);
    const formattedSite = await formatSiteResponse(hydratedSite);

    return reply.code(200).send({
      message: 'Site updated successfully',
      site: formattedSite,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 