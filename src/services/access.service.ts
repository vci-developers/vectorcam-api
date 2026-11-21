import { Role, RolePermission, Site, SiteUser, UserRole } from '../db/models';
import { expandSiteIdsWithDescendants } from '../handlers/site/common';
import { AccessContext, SiteIdLoader } from './accessContext';

function createSiteIdLoader(programId: number, assignedSiteIds: number[]): SiteIdLoader {
  return async (scope) => {
    if (scope === 'program') {
      const sites = await Site.findAll({ where: { programId }, attributes: ['id'] });
      return sites.map((site) => site.id);
    }

    const expandedSiteIds = await expandSiteIdsWithDescendants(assignedSiteIds);
    if (expandedSiteIds.length === 0) return [];
    const sites = await Site.findAll({ where: { id: expandedSiteIds, programId }, attributes: ['id'] });
    return sites.map((site) => site.id);
  };
}

/**
 * Builds the access context for a whitelisted user from their role assignments.
 * Roles that belong to a different program than the user's are ignored.
 */
export async function loadUserAccess(userId: number, programId: number | null): Promise<AccessContext> {
  if (programId == null) {
    return AccessContext.none();
  }

  const [assignments, siteUsers] = await Promise.all([
    UserRole.findAll({
      where: { userId },
      attributes: ['userId', 'roleId', 'scope'],
      include: [{
        model: Role,
        as: 'role',
        required: true,
        attributes: ['id', 'programId'],
        include: [{ model: RolePermission, as: 'permissions', attributes: ['roleId', 'permission'] }],
      }],
    }),
    SiteUser.findAll({ where: { userId }, attributes: ['siteId'] }),
  ]);

  const grants = assignments.flatMap((assignment) => {
    const role = assignment.role;
    if (!role || (role.programId !== null && role.programId !== programId)) {
      return [];
    }
    return (role.permissions ?? []).map((rolePermission) => ({
      permission: rolePermission.permission,
      scope: assignment.scope,
    }));
  });

  const assignedSiteIds = siteUsers.map((siteUser) => siteUser.siteId);

  return AccessContext.forUser({
    programId,
    grants,
    assignedSiteIds,
    loadSiteIds: createSiteIdLoader(programId, assignedSiteIds),
  });
}
