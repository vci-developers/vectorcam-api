import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { Site, Program, Session, LocationType } from '../../db/models';
// Site response format interface
export interface SiteResponse {
  siteId: number;
  programId: number;
  isActive: boolean;
  hasData: boolean;
  // Optional details, omitted if empty
  locationTypeId?: number;
  parentId?: number;
  name?: string;
  district?: string;
  subCounty?: string;
  parish?: string;
  villageName?: string;
  houseNumber?: string;
  healthCenter?: string;
  // Location hierarchy map keyed by location type name -> site name
  locationHierarchy?: Record<string, string>;
}

const locationTypeNameCache = new Map<number, string>();

async function getLocationTypeName(locationTypeId?: number | null): Promise<string | null> {
  if (!locationTypeId) return null;
  if (locationTypeNameCache.has(locationTypeId)) {
    return locationTypeNameCache.get(locationTypeId)!;
  }
  const locationType = await LocationType.findByPk(locationTypeId);
  if (!locationType) return null;
  locationTypeNameCache.set(locationTypeId, locationType.name);
  return locationType.name;
}

// Build location map by traversing up the parent chain (including current site)
async function ensureSiteWithRelations(site: Site): Promise<Site> {
  const needsLocationType = !site.get('locationType') && site.locationTypeId;
  const needsParent = site.parentId && !site.get('parent');

  if (!needsLocationType && !needsParent) return site;

  const reloaded = await Site.findByPk(site.id, {
    include: [
      { model: LocationType, as: 'locationType', attributes: ['id', 'name'] },
      {
        model: Site,
        as: 'parent',
        include: [{ model: LocationType, as: 'locationType', attributes: ['id', 'name'] }],
      },
    ],
  });

  return reloaded ?? site;
}

async function rebuildLocationMap(site: Site): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const visited = new Set<number>();
  let current: Site | null = await ensureSiteWithRelations(site);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    const siteName = current.name?.trim();
    const includedLocationType = current.get('locationType') as LocationType | undefined;
    const locationTypeName = includedLocationType?.name ?? (await getLocationTypeName(current.locationTypeId));

    if (locationTypeName && siteName) {
      map[locationTypeName] = siteName;
    }

    if (!current.parentId) break;

    const includedParent = current.get('parent') as Site | null;
    if (includedParent) {
      current = includedParent;
    } else {
      current = await Site.findByPk(current.parentId, {
        include: [
          { model: LocationType, as: 'locationType', attributes: ['id', 'name'] },
          {
            model: Site,
            as: 'parent',
            include: [{ model: LocationType, as: 'locationType', attributes: ['id', 'name'] }],
          },
        ],
      });
    }
  }

  return map;
}

// Helper to format site data consistently across endpoints with dynamic location map
export async function formatSiteResponse(site: Site): Promise<SiteResponse> {
  const base: SiteResponse = {
    siteId: site.id,
    programId: site.programId,
    isActive: site.isActive,
    hasData: site.hasData,
  };

  if (site.locationTypeId != null) base.locationTypeId = site.locationTypeId;
  if (site.parentId != null) base.parentId = site.parentId;
  if (site.name && site.name.trim() !== '') base.name = site.name;
  if (site.district && site.district.trim() !== '') base.district = site.district.trim();
  if (site.subCounty && site.subCounty.trim() !== '') base.subCounty = site.subCounty.trim();
  if (site.parish && site.parish.trim() !== '') base.parish = site.parish.trim();
  if (site.villageName && site.villageName.trim() !== '') base.villageName = site.villageName.trim();
  if (site.houseNumber && site.houseNumber.trim() !== '') base.houseNumber = site.houseNumber.trim();
  if (site.healthCenter && site.healthCenter.trim() !== '') base.healthCenter = site.healthCenter.trim();

  const locationMap = site.locationHierarchy ?? (await rebuildLocationMap(site));

  return {
    ...base,
    locationHierarchy: locationMap,
  };
}

// Rebuild and persist location hierarchy for a site and all its descendants
export async function rebuildLocationHierarchy(rootSite: Site): Promise<Site> {
  const hierarchyById = new Map<number, Record<string, string>>();

  const rootMap = await rebuildLocationMap(rootSite);
  hierarchyById.set(rootSite.id, rootMap);
  await rootSite.update({ locationHierarchy: rootMap });

  let frontierIds = [rootSite.id];

  while (frontierIds.length > 0) {
    const children = await Site.findAll({
      where: {
        parentId: {
          [Op.in]: frontierIds,
        },
      },
    });

    frontierIds = [];

    for (const child of children) {
      const parentMap = hierarchyById.get(child.parentId!) || {};
      const map: Record<string, string> = { ...parentMap };
      const typeName = await getLocationTypeName(child.locationTypeId);
      const childName = child.name?.trim();
      if (typeName && childName) {
        map[typeName] = childName;
      }
      hierarchyById.set(child.id, map);
      await child.update({ locationHierarchy: map });
      frontierIds.push(child.id);
    }
  }

  const refreshed = await Site.findByPk(rootSite.id);
  return refreshed ?? rootSite;
}

export async function rebuildLocationHierarchyForLocationType(locationTypeId: number): Promise<void> {
  const sites = await Site.findAll({ where: { locationTypeId } });
  for (const site of sites) {
    await rebuildLocationHierarchy(site);
  }
}

// Check if site exists by ID
export async function findSiteById(siteId: number): Promise<Site | null> {
  return await Site.findByPk(siteId);
}

// Check if program exists by ID
export async function findProgramById(programId: number): Promise<Program | null> {
  return await Program.findByPk(programId);
}

// Common error handler
export function handleError(error: any, request: FastifyRequest, reply: FastifyReply, message: string = 'An error occurred'): void {
  request.log.error(error);
  reply.code(500).send({ error: message });
}

// Check if site has associated sessions
export async function hasAssociatedSessions(siteId: number): Promise<boolean> {
  const sessionCount = await Session.count({
    where: { siteId },
  });
  return sessionCount > 0;
}

// Check if site has child sites
export async function hasChildSites(siteId: number): Promise<boolean> {
  const childCount = await Site.count({
    where: { parentId: siteId },
  });
  return childCount > 0;
}
