/**
 * Permission catalog. Roles stored in the database may only reference permissions
 * from SITE_PERMISSIONS and PROGRAM_PERMISSIONS; SYSTEM_PERMISSIONS are never part
 * of a role and are only held by the admin token, developer users, and the mobile token.
 */
export const SITE_PERMISSIONS = [
  'site:read',
  'site:write',
  'session:read',
  'session:write',
  'specimen:read',
  'specimen:write',
  'dhis2:push',
] as const;

export const PROGRAM_PERMISSIONS = [
  'site:create',
  'program:locations',
  'program:forms',
  'data:export',
  'annotation:annotate',
  'annotation:read',
  'annotation:manage',
] as const;

export const SYSTEM_PERMISSIONS = [
  'mobile:app',
  'system:admin',
] as const;

export type SitePermission = (typeof SITE_PERMISSIONS)[number];
export type ProgramPermission = (typeof PROGRAM_PERMISSIONS)[number];
export type SystemPermission = (typeof SYSTEM_PERMISSIONS)[number];
export type GrantablePermission = SitePermission | ProgramPermission;
export type Permission = GrantablePermission | SystemPermission;

export const GRANTABLE_PERMISSIONS: readonly GrantablePermission[] = [...SITE_PERMISSIONS, ...PROGRAM_PERMISSIONS];
export const ALL_PERMISSIONS: readonly Permission[] = [...GRANTABLE_PERMISSIONS, ...SYSTEM_PERMISSIONS];

export const ASSIGNMENT_SCOPES = ['program', 'assigned_sites'] as const;
export type AssignmentScope = (typeof ASSIGNMENT_SCOPES)[number];

const grantablePermissionSet = new Set<string>(GRANTABLE_PERMISSIONS);
const programPermissionSet = new Set<string>(PROGRAM_PERMISSIONS);

export function isGrantablePermission(value: string): value is GrantablePermission {
  return grantablePermissionSet.has(value);
}

export function isProgramPermission(value: string): value is ProgramPermission {
  return programPermissionSet.has(value);
}

export function isAssignmentScope(value: string): value is AssignmentScope {
  return (ASSIGNMENT_SCOPES as readonly string[]).includes(value);
}

export const MOBILE_APP_PERMISSIONS: readonly Permission[] = [
  'mobile:app',
  'site:create',
  'site:read',
  'site:write',
  'session:read',
  'session:write',
  'specimen:read',
  'specimen:write',
];

const VIEWER_PERMISSIONS: GrantablePermission[] = ['site:read', 'session:read', 'specimen:read'];
const EDITOR_PERMISSIONS: GrantablePermission[] = [
  ...VIEWER_PERMISSIONS,
  'site:write',
  'session:write',
  'specimen:write',
  'dhis2:push',
];
const PROGRAM_MANAGER_PERMISSIONS: GrantablePermission[] = [
  ...EDITOR_PERMISSIONS,
  'site:create',
  'program:locations',
  'data:export',
];
const PROGRAM_ADMIN_PERMISSIONS: GrantablePermission[] = [
  ...PROGRAM_MANAGER_PERMISSIONS,
  'program:forms',
  'annotation:annotate',
  'annotation:read',
];

export const BUILT_IN_ROLES = [
  { key: 'viewer', name: 'Viewer', permissions: VIEWER_PERMISSIONS },
  { key: 'editor', name: 'Editor', permissions: EDITOR_PERMISSIONS },
  { key: 'program_manager', name: 'Program Manager', permissions: PROGRAM_MANAGER_PERMISSIONS },
  { key: 'program_admin', name: 'Program Admin', permissions: PROGRAM_ADMIN_PERMISSIONS },
] as const;

export type BuiltInRoleKey = (typeof BUILT_IN_ROLES)[number]['key'];

/**
 * Role assignment equivalent to each legacy `users.privilege` level.
 */
export const LEGACY_PRIVILEGE_ASSIGNMENTS: Readonly<Record<number, { roleKey: BuiltInRoleKey; scope: AssignmentScope }>> = {
  0: { roleKey: 'viewer', scope: 'assigned_sites' },
  1: { roleKey: 'viewer', scope: 'program' },
  2: { roleKey: 'editor', scope: 'assigned_sites' },
  3: { roleKey: 'program_manager', scope: 'program' },
  4: { roleKey: 'program_admin', scope: 'program' },
};

export const LEGACY_PRIVILEGES = Object.keys(LEGACY_PRIVILEGE_ASSIGNMENTS).map(Number);

/**
 * Best-effort legacy privilege for clients that still read `users.privilege`: the highest
 * level whose built-in role permissions are all granted at that level's scope or wider, or 0.
 */
export function legacyPrivilegeFor(grants: Array<{ permission: string; scope: AssignmentScope }>): number {
  let privilege = 0;
  for (const level of LEGACY_PRIVILEGES) {
    const legacy = LEGACY_PRIVILEGE_ASSIGNMENTS[level];
    const role = BUILT_IN_ROLES.find((builtInRole) => builtInRole.key === legacy.roleKey)!;
    const covered = role.permissions.every((permission) =>
      grants.some((grant) =>
        grant.permission === permission && (grant.scope === 'program' || legacy.scope === 'assigned_sites')
      )
    );
    if (covered) {
      privilege = Math.max(privilege, level);
    }
  }
  return privilege;
}
