import { FastifyRequest, FastifyReply } from 'fastify';
import { Site } from '../../db/models';
import { formatSiteResponse, findProgramById, rebuildLocationHierarchy } from './common';

interface CreateSiteRequest {
  programId: number;
  locationTypeId?: number;
  parentId?: number;
  name?: string;
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
  body: {
    type: 'object',
    required: ['programId'],
    properties: {
      programId: { type: 'number' },
      locationTypeId: { type: 'number' },
      parentId: { type: 'number' },
      name: { type: 'string' },
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
          },
          // Allow dynamic location keys (e.g., { [locationTypeName]: siteName })
          additionalProperties: { type: ['string', 'number', 'boolean', 'null'] },
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
    const { programId, locationTypeId, parentId, name, district, subCounty, parish, villageName, houseNumber, isActive, healthCenter } = request.body;

    // Validate user can create sites
    const siteAccess = request.siteAccess;
    if (!siteAccess?.canWrite) {
      return reply.code(403).send({ error: 'Forbidden: Insufficient permissions to create sites' });
    }

    // For user JWT tokens (not admin/mobile), enforce program scope:
    // only privilege 3 users can create sites, and only within their own program
    if (request.authType === 'user' && request.user) {
      if (request.user.privilege < 3) {
        return reply.code(403).send({ error: 'Forbidden: Only program admins (privilege 3) can create sites' });
      }
      if (programId !== request.user.programId) {
        return reply.code(403).send({ error: 'Forbidden: Cannot create sites in a different program' });
      }
    }

    // Check if program exists
    const program = await findProgramById(programId);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const site = await Site.create({
      programId,
      locationTypeId,
      parentId,
      name,
      district,
      subCounty,
      parish,
      villageName,
      houseNumber,
      isActive,
      healthCenter,
    });

    const hydratedSite = await rebuildLocationHierarchy(site);
    const formattedSite = await formatSiteResponse(hydratedSite);

    return reply.code(200).send({
      message: 'Site created successfully',
      site: formattedSite,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
} 