import { FastifyRequest, FastifyReply } from 'fastify';
import { LocationType, Program, Site } from '../../../db/models';
import { rebuildLocationHierarchyForLocationType } from '../../site/common';

export interface LocationTypeResponse {
  id: number;
  programId: number;
  name: string;
  level: number;
}

export function formatLocationTypeResponse(locationType: LocationType): LocationTypeResponse {
  return {
    id: locationType.id,
    programId: locationType.programId,
    name: locationType.name,
    level: locationType.level,
  };
}

export async function findProgramById(programId: number): Promise<Program | null> {
  return Program.findByPk(programId);
}

export async function rebuildSitesForLocationType(locationTypeId: number): Promise<void> {
  await rebuildLocationHierarchyForLocationType(locationTypeId);
}

export function handleError(error: any, request: FastifyRequest, reply: FastifyReply, message = 'Internal Server Error') {
  request.log.error(error);
  return reply.code(500).send({ error: message });
}

export async function hasAssociatedSites(locationTypeId: number): Promise<boolean> {
  const siteCount = await Site.count({
    where: { locationTypeId },
  });
  return siteCount > 0;
}


