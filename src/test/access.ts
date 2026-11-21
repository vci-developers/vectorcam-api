import { AccessContext } from '../services/accessContext';
import { GRANTABLE_PERMISSIONS } from '../services/permissions';

/**
 * A user whose site permissions cover exactly `siteIds` (child sites already included).
 * Program-wide permissions are not granted.
 */
export function assignedSitesAccess(siteIds: number[], programId = 1): AccessContext {
  return AccessContext.forUser({
    programId,
    grants: GRANTABLE_PERMISSIONS.map((permission) => ({ permission, scope: 'assigned_sites' as const })),
    assignedSiteIds: siteIds,
    loadSiteIds: async () => siteIds,
  });
}

export function unrestrictedAccess(): AccessContext {
  return AccessContext.unrestricted();
}
