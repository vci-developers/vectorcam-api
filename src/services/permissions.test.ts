import {
  AssignmentScope,
  BUILT_IN_ROLES,
  GRANTABLE_PERMISSIONS,
  isProgramPermission,
  LEGACY_PRIVILEGE_ASSIGNMENTS,
  legacyPrivilegeFor,
} from './permissions';

describe('permission catalog', () => {
  it('builds each built-in role on top of the previous one', () => {
    for (let index = 1; index < BUILT_IN_ROLES.length; index++) {
      const previous = BUILT_IN_ROLES[index - 1].permissions;
      const current = BUILT_IN_ROLES[index].permissions;
      expect(current).toEqual(expect.arrayContaining([...previous]));
    }
  });

  it('only uses grantable permissions in built-in roles', () => {
    for (const role of BUILT_IN_ROLES) {
      for (const permission of role.permissions) {
        expect(GRANTABLE_PERMISSIONS).toContain(permission);
      }
    }
  });

  it('maps legacy privileges to assignments whose roles are valid at that scope', () => {
    for (const legacy of Object.values(LEGACY_PRIVILEGE_ASSIGNMENTS)) {
      const role = BUILT_IN_ROLES.find((candidate) => candidate.key === legacy.roleKey)!;
      if (legacy.scope === 'assigned_sites') {
        expect(role.permissions.filter(isProgramPermission)).toEqual([]);
      }
    }
  });

  it('keeps the read-only roles away from DHIS2 push', () => {
    const viewer = BUILT_IN_ROLES.find((role) => role.key === 'viewer')!;
    expect(viewer.permissions).not.toContain('dhis2:push');
  });
});

describe('legacyPrivilegeFor', () => {
  const grantsOf = (roleKey: string, scope: AssignmentScope) =>
    BUILT_IN_ROLES.find((role) => role.key === roleKey)!.permissions.map((permission) => ({ permission, scope }));

  it('round-trips every legacy level', () => {
    for (const [level, assignment] of Object.entries(LEGACY_PRIVILEGE_ASSIGNMENTS)) {
      expect(legacyPrivilegeFor(grantsOf(assignment.roleKey, assignment.scope))).toBe(Number(level));
    }
  });

  it('picks the highest level covered by the combined grants', () => {
    expect(legacyPrivilegeFor([
      ...grantsOf('viewer', 'program'),
      ...grantsOf('editor', 'assigned_sites'),
    ])).toBe(2);
    expect(legacyPrivilegeFor(grantsOf('editor', 'program'))).toBe(2);
  });

  it('maps custom roles to the level they cover', () => {
    const dataReviewer = ['site:read', 'session:read', 'specimen:read', 'annotation:read'];
    expect(legacyPrivilegeFor(dataReviewer.map((permission) => ({ permission, scope: 'program' as const })))).toBe(1);
    expect(legacyPrivilegeFor([{ permission: 'site:read', scope: 'program' }])).toBe(0);
    expect(legacyPrivilegeFor([])).toBe(0);
  });
});
