import { Site } from '../src/db/models';
import { Op } from 'sequelize';
import { rebuildLocationHierarchy } from '../src/handlers/site/common';

async function rebuildLocationHierarchyForEligibleRoots() {
  let processedRootSiteCount = 0;

  // Rebuild only for root sites with a location type.
  // Each root call updates the entire subtree recursively.
  const rootSites = await Site.findAll({
    where: {
      parentId: null,
      locationTypeId: { [Op.not]: null },
    },
  });

  for (const rootSite of rootSites) {
    await rebuildLocationHierarchy(rootSite);
    processedRootSiteCount += 1;
  }

  console.log(`Rebuilt location hierarchy from ${processedRootSiteCount} eligible root site(s).`);
}

// For any site that wasn't covered by an eligible root rebuild (e.g. a root site without a
// locationTypeId, or any site whose locationHierarchy is still missing/empty), make sure
// its own id appears in locationHierarchy.siteIds so that siteId filters using
// JSON_CONTAINS continue to match the site itself.
async function backfillSelfSiteIdForSitesMissingHierarchy() {
  let backfilledCount = 0;

  const sites = await Site.findAll({ attributes: ['id', 'locationHierarchy'] });

  for (const site of sites) {
    const current = site.locationHierarchy;
    const hasStructuredHierarchy =
      current !== null && typeof current === 'object' && !Array.isArray(current);

    const existingSiteIds: number[] = hasStructuredHierarchy && Array.isArray((current as any).siteIds)
      ? ((current as any).siteIds as unknown[]).filter((id): id is number => Number.isInteger(id) && (id as number) > 0)
      : [];

    if (existingSiteIds.includes(site.id)) continue;

    const existingHierarchy = hasStructuredHierarchy && Array.isArray((current as any).hierarchy)
      ? (current as any).hierarchy
      : [];

    await site.update({
      locationHierarchy: {
        hierarchy: existingHierarchy,
        siteIds: [...existingSiteIds, site.id],
      },
    });
    backfilledCount += 1;
  }

  console.log(`Backfilled self id into locationHierarchy.siteIds for ${backfilledCount} site(s).`);
}

async function main() {
  try {
    console.log('Rebuilding locationHierarchy for eligible root sites and their subtrees...');
    await rebuildLocationHierarchyForEligibleRoots();
    console.log('Backfilling self id for sites without a hierarchy...');
    await backfillSelfSiteIdForSitesMissingHierarchy();
    console.log('Location hierarchy rebuild completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Location hierarchy rebuild failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default rebuildLocationHierarchyForEligibleRoots;
