import { AccessContext } from './accessContext';
import { MOBILE_APP_PERMISSIONS } from './permissions';

function userAccess(
  grants: Array<{ permission: string; scope: 'program' | 'assigned_sites' }>,
  assignedSiteIds: number[] = [10],
  loadSiteIds = jest.fn(async (scope: 'program' | 'assigned_sites') =>
    scope === 'program' ? [10, 11, 12, 13] : [10, 11]
  )
) {
  const access = AccessContext.forUser({ programId: 1, grants, assignedSiteIds, loadSiteIds });
  return { access, loadSiteIds };
}

describe('AccessContext', () => {
  it('grants nothing by default', async () => {
    const access = AccessContext.none();

    expect(access.has('site:read')).toBe(false);
    expect(access.allPrograms).toBe(false);
    expect(access.canAccessProgram(1)).toBe(false);
    expect(await access.siteIdsFor('site:read')).toEqual([]);
  });

  it('gives unrestricted principals every site in every program', async () => {
    const access = AccessContext.unrestricted();

    expect(access.has('system:admin')).toBe(true);
    expect(access.allPrograms).toBe(true);
    expect(access.canAccessProgram(42)).toBe(true);
    expect(await access.siteIdsFor('specimen:read')).toBeNull();
    expect(await access.canAccessSite('specimen:write', 999)).toBe(true);
  });

  it('limits the mobile token to its own permission list', () => {
    const access = AccessContext.unrestricted(MOBILE_APP_PERMISSIONS);

    expect(access.has('session:write')).toBe(true);
    expect(access.has('dhis2:push')).toBe(false);
    expect(access.has('system:admin')).toBe(false);
  });

  it('resolves program and assigned-site scopes through the loader', async () => {
    const { access } = userAccess([
      { permission: 'specimen:read', scope: 'program' },
      { permission: 'specimen:write', scope: 'assigned_sites' },
    ]);

    expect(await access.siteIdsFor('specimen:read')).toEqual([10, 11, 12, 13]);
    expect(await access.siteIdsFor('specimen:write')).toEqual([10, 11]);
    expect(await access.canAccessSite('specimen:write', 12)).toBe(false);
    expect(await access.canAccessSite('specimen:read', 12)).toBe(true);
    expect(await access.siteIdsFor('dhis2:push')).toEqual([]);
  });

  it('loads each scope once per request', async () => {
    const { access, loadSiteIds } = userAccess([
      { permission: 'site:read', scope: 'assigned_sites' },
      { permission: 'session:read', scope: 'assigned_sites' },
    ]);

    await access.siteIdsFor('site:read');
    await access.siteIdsFor('session:read');
    await access.canAccessSite('site:read', 10);

    expect(loadSiteIds).toHaveBeenCalledTimes(1);
    expect(loadSiteIds).toHaveBeenCalledWith('assigned_sites');
  });

  it('keeps the wider scope when a permission is granted twice', () => {
    const { access } = userAccess([
      { permission: 'site:read', scope: 'assigned_sites' },
      { permission: 'site:read', scope: 'program' },
      { permission: 'site:write', scope: 'program' },
      { permission: 'site:write', scope: 'assigned_sites' },
    ]);

    expect(access.scopeOf('site:read')).toBe('program');
    expect(access.scopeOf('site:write')).toBe('program');
  });

  it('ignores program permissions granted on assigned sites', () => {
    const { access } = userAccess([
      { permission: 'data:export', scope: 'assigned_sites' },
      { permission: 'annotation:read', scope: 'program' },
    ]);

    expect(access.has('data:export')).toBe(false);
    expect(access.has('annotation:read')).toBe(true);
  });

  it('drops assigned-site grants when the user has no assigned sites', () => {
    const { access } = userAccess(
      [
        { permission: 'site:read', scope: 'assigned_sites' },
        { permission: 'session:read', scope: 'program' },
      ],
      []
    );

    expect(access.has('site:read')).toBe(false);
    expect(access.has('session:read')).toBe(true);
  });

  it('ignores unknown and system permissions from the database', () => {
    const { access } = userAccess([
      { permission: 'system:admin', scope: 'program' },
      { permission: 'mobile:app', scope: 'program' },
      { permission: 'made:up', scope: 'program' },
    ]);

    expect(access.grants()).toEqual([]);
  });

  it('is bound to the user\'s own program', () => {
    const { access } = userAccess([{ permission: 'program:forms', scope: 'program' }]);

    expect(access.allPrograms).toBe(false);
    expect(access.canAccessProgram(1)).toBe(true);
    expect(access.canAccessProgram(2)).toBe(false);
  });

  it('lists grants in catalog order', () => {
    const { access } = userAccess([
      { permission: 'annotation:read', scope: 'program' },
      { permission: 'site:read', scope: 'assigned_sites' },
    ]);

    expect(access.grants()).toEqual([
      { permission: 'site:read', scope: 'assigned_sites' },
      { permission: 'annotation:read', scope: 'program' },
    ]);
  });
});
