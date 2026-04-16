import { FastifyRequest, FastifyReply } from 'fastify';
import { Op, fn, col, where, literal, WhereOptions } from 'sequelize';
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

export interface LocationHierarchyEntry {
  locationType: string;
  value: string;
}

interface StoredLocationHierarchy {
  hierarchy: LocationHierarchyEntry[];
  siteIds: number[];
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

function entriesToHierarchyMap(entries: LocationHierarchyEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of entries) {
    map[entry.locationType] = entry.value;
  }
  return map;
}

function normalizeSiteIdArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is number => Number.isInteger(id) && id > 0);
}

function normalizeHierarchyEntries(raw: unknown): LocationHierarchyEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is LocationHierarchyEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as Record<string, unknown>;
      return typeof candidate.locationType === 'string' && typeof candidate.value === 'string';
    })
    .map((entry) => ({
      locationType: entry.locationType.trim(),
      value: entry.value.trim(),
    }))
    .filter((entry) => entry.locationType !== '' && entry.value !== '');
}

function normalizeStoredLocationHierarchy(raw: unknown): StoredLocationHierarchy {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const candidate = raw as Record<string, unknown>;
    return {
      hierarchy: normalizeHierarchyEntries(candidate.hierarchy),
      siteIds: normalizeSiteIdArray(candidate.siteIds),
    };
  }

  return {
    hierarchy: [],
    siteIds: [],
  };
}

interface RebuiltLocationData {
  hierarchyEntries: LocationHierarchyEntry[];
  siteIds: number[];
}

async function rebuildLocationData(site: Site): Promise<RebuiltLocationData> {
  const traversedNodes: Array<{ siteId: number; locationType: string; value: string }> = [];
  const traversedSiteIds: number[] = [];
  const visited = new Set<number>();
  let current: Site | null = await ensureSiteWithRelations(site);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    traversedSiteIds.push(current.id);

    const siteName = current.name?.trim();
    const includedLocationType = current.get('locationType') as LocationType | undefined;
    const locationTypeName = includedLocationType?.name ?? (await getLocationTypeName(current.locationTypeId));

    if (locationTypeName && siteName) {
      traversedNodes.push({
        siteId: current.id,
        locationType: locationTypeName,
        value: siteName,
      });
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

  const orderedNodes = traversedNodes.reverse();
  const siteIds = traversedSiteIds.reverse();
  return {
    hierarchyEntries: orderedNodes.map((node) => ({
      locationType: node.locationType,
      value: node.value,
    })),
    siteIds,
  };
}

async function rebuildLocationMap(site: Site): Promise<Record<string, string>> {
  const locationData = await rebuildLocationData(site);
  return entriesToHierarchyMap(locationData.hierarchyEntries);
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

  const storedEntries = normalizeStoredLocationHierarchy(site.locationHierarchy).hierarchy;
  const locationMap = storedEntries.length > 0
    ? entriesToHierarchyMap(storedEntries)
    : (await rebuildLocationMap(site));

  return {
    ...base,
    locationHierarchy: locationMap,
  };
}

// Rebuild and persist location hierarchy for a site and all its descendants
export async function rebuildLocationHierarchy(rootSite: Site): Promise<Site> {
  const hierarchyById = new Map<number, RebuiltLocationData>();
  const hydratedRootSite =
    (await Site.findByPk(rootSite.id, {
      include: [
        { model: LocationType, as: 'locationType', attributes: ['id', 'name'] },
        {
          model: Site,
          as: 'parent',
          include: [{ model: LocationType, as: 'locationType', attributes: ['id', 'name'] }],
        },
      ],
    })) ?? rootSite;

  const rootData = await rebuildLocationData(hydratedRootSite);
  hierarchyById.set(hydratedRootSite.id, rootData);
  await hydratedRootSite.update({
    locationHierarchy: {
      hierarchy: rootData.hierarchyEntries,
      siteIds: rootData.siteIds,
    },
  });

  let frontierIds = [hydratedRootSite.id];

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
      const parentData = hierarchyById.get(child.parentId!);
      const hierarchyEntries: LocationHierarchyEntry[] = parentData
        ? [...parentData.hierarchyEntries]
        : [];
      const siteIds: number[] = parentData ? [...parentData.siteIds] : [];
      const typeName = await getLocationTypeName(child.locationTypeId);
      const childName = child.name?.trim();
      if (!siteIds.includes(child.id)) {
        siteIds.push(child.id);
      }
      if (typeName && childName) {
        hierarchyEntries.push({ locationType: typeName, value: childName });
      }
      hierarchyById.set(child.id, { hierarchyEntries, siteIds });
      await child.update({
        locationHierarchy: {
          hierarchy: hierarchyEntries,
          siteIds,
        },
      });
      frontierIds.push(child.id);
    }
  }

  const refreshed = await Site.findByPk(hydratedRootSite.id);
  return refreshed ?? hydratedRootSite;
}

export async function rebuildLocationHierarchyForLocationType(locationTypeId: number): Promise<void> {
  const sites = await Site.findAll({ where: { locationTypeId } });
  for (const site of sites) {
    await rebuildLocationHierarchy(site);
  }
}

function normalizeSiteIds(siteIds: number[]): number[] {
  return Array.from(
    new Set(
      siteIds.filter((siteId) => Number.isInteger(siteId) && siteId > 0)
    )
  );
}

// Where fragment that matches Site rows in the subtree rooted at any of rootSiteIds,
// using the JSON-encoded location_hierarchy.siteIds field. Intended to be merged into
// an existing siteWhere when the endpoint already queries the Site table directly.
export function buildSiteSubtreeWhere(rootSiteIds: number[]): WhereOptions | null {
  const normalized = normalizeSiteIds(rootSiteIds);
  if (normalized.length === 0) return null;

  return {
    [Op.or]: normalized.map((rootSiteId) => where(
      fn(
        'JSON_CONTAINS',
        fn(
          'JSON_EXTRACT',
          fn('COALESCE', col('location_hierarchy'), literal('JSON_OBJECT()')),
          literal("'$.siteIds'")
        ),
        fn('JSON_ARRAY', rootSiteId)
      ),
      1
    )),
  } as WhereOptions;
}

// Literal subquery that yields the id set of the subtree rooted at rootSiteId.
// Use with `{ [Op.in]: siteIdInSubtreeOfLiteral(siteId) }` on non-Site tables
// (Session, SessionConflictResolution, ReviewActionLog, etc.) to avoid pre-expanding.
export function siteIdInSubtreeOfLiteral(rootSiteId: number) {
  const id = Number(rootSiteId);
  return literal(
    `(SELECT id FROM sites WHERE JSON_CONTAINS(JSON_EXTRACT(COALESCE(location_hierarchy, JSON_OBJECT()), '$.siteIds'), JSON_ARRAY(${id})))`
  );
}

// Expand an array of accessible root site ids into the flat list of every site in their
// subtrees, using the JSON-encoded location_hierarchy.siteIds field. Use ONLY for the
// caller's site-access list; requested siteId/siteIds filters should use
// buildSiteSubtreeWhere or siteIdInSubtreeOfLiteral directly in the query.
export async function expandSiteIdsWithDescendants(accessibleSiteIds: number[]): Promise<number[]> {
  const normalizedRootSiteIds = normalizeSiteIds(accessibleSiteIds);
  if (normalizedRootSiteIds.length === 0) return [];

  const subtreeWhere = buildSiteSubtreeWhere(normalizedRootSiteIds);
  if (!subtreeWhere) return [];

  const matchingSites = await Site.findAll({
    where: subtreeWhere,
    attributes: ['id'],
  });

  const expanded = new Set<number>(normalizedRootSiteIds);
  for (const site of matchingSites) expanded.add(site.id);
  return Array.from(expanded);
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
