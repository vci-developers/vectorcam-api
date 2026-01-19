import { FastifyRequest, FastifyReply } from 'fastify';
import { LocationType, Program, Site } from '../../../db/models';
import { rebuildLocationHierarchyForLocationType } from '../../site/common';

export interface LocationTypeResponse {
  id: number;
  programId: number | null;
  name: string;
}

export function formatLocationTypeResponse(locationType: LocationType): LocationTypeResponse {
  return {
    id: locationType.id,
    programId: locationType.programId ?? null,
    name: locationType.name,
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


