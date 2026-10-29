import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { LocationType, Program, Site } from '../../../db/models';
import { rebuildLocationHierarchyForLocationType } from '../../site/common';

export interface LocationTypeResponse {
  id: number;
  programId: number;
  parentId: number | null;
  name: string;
  level: number;
}

export function formatLocationTypeResponse(locationType: LocationType): LocationTypeResponse {
  return {
    id: locationType.id,
    programId: locationType.programId,
    parentId: locationType.parentId ?? null,
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

export async function hasChildLocationTypes(locationTypeId: number): Promise<boolean> {
  const childCount = await LocationType.count({
    where: { parentId: locationTypeId },
  });
  return childCount > 0;
}

export async function isLocationTypeDescendant(
  ancestorId: number,
  candidateId: number
): Promise<boolean> {
  let currentId: number | null = candidateId;
  const visited = new Set<number>();

  while (currentId !== null && !visited.has(currentId)) {
    if (currentId === ancestorId) return true;
    visited.add(currentId);
    const row: Pick<LocationType, 'parentId'> | null = await LocationType.findByPk(currentId, {
      attributes: ['parentId'],
    });
    currentId = row?.parentId ?? null;
  }

  return false;
}

export interface ResolvedLocationTypePlacement {
  parentId: number | null;
  level: number;
}

export async function resolveLocationTypePlacement(
  programId: number,
  parentId: number | null | undefined,
  explicitLevel?: number
): Promise<ResolvedLocationTypePlacement> {
  if (parentId === null) {
    return { parentId: null, level: explicitLevel ?? 1 };
  }

  if (parentId !== undefined) {
    const parent = await LocationType.findOne({ where: { id: parentId, programId } });
    if (!parent) {
      throw new Error('PARENT_NOT_FOUND');
    }
    return { parentId, level: parent.level + 1 };
  }

  if (explicitLevel !== undefined) {
    return { parentId: null, level: explicitLevel };
  }

  const deepestType = await LocationType.findOne({
    where: { programId },
    order: [['level', 'DESC'], ['id', 'DESC']],
  });
  if (!deepestType) {
    return { parentId: null, level: 1 };
  }

  return {
    parentId: deepestType.id,
    level: deepestType.level + 1,
  };
}

export async function validateLocationTypeParent(params: {
  programId: number;
  locationTypeId?: number;
  parentId: number | null;
  level: number;
}): Promise<string | null> {
  const { programId, locationTypeId, parentId, level } = params;

  if (parentId === null) {
    if (level > 1) {
      return 'Root location types must have level 1';
    }
    return null;
  }

  if (locationTypeId !== undefined && parentId === locationTypeId) {
    return 'Location type cannot be its own parent';
  }

  const parent = await LocationType.findOne({ where: { id: parentId, programId } });
  if (!parent) {
    return 'Parent location type not found in this program';
  }

  if (level !== parent.level + 1) {
    return 'Location type level must be exactly one greater than its parent level';
  }

  if (locationTypeId !== undefined) {
    const createsCycle = await isLocationTypeDescendant(locationTypeId, parentId);
    if (createsCycle) {
      return 'Parent location type cannot be a descendant of this location type';
    }
  }

  return null;
}

export async function findDuplicateLocationTypeName(
  programId: number,
  name: string,
  excludeId?: number
): Promise<LocationType | null> {
  return LocationType.findOne({
    where: {
      programId,
      name,
      ...(excludeId !== undefined ? { id: { [Op.ne]: excludeId } } : {}),
    },
  });
}
