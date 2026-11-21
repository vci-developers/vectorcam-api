import {
  RoleSummary,
  validateRoleAssignments,
  validateRoleKey,
  validateRolePermissions,
} from './roles.service';

jest.mock('../db/models', () => ({
  Role: {},
  RolePermission: {},
  User: {},
  UserRole: {},
}));

const viewer: RoleSummary = {
  id: 1,
  key: 'viewer',
  name: 'Viewer',
  programId: null,
  permissions: ['site:read', 'session:read', 'specimen:read'],
};

const dataReviewer: RoleSummary = {
  id: 5,
  key: 'data_reviewer',
  name: 'Data Reviewer',
  programId: 1,
  permissions: ['specimen:read', 'annotation:read'],
};

const rolesById = new Map([viewer, dataReviewer].map((role) => [role.id, role]));

describe('validateRoleAssignments', () => {
  it('accepts built-in and program roles at valid scopes', () => {
    expect(validateRoleAssignments(1, [
      { roleId: 1, scope: 'assigned_sites' },
      { roleId: 5, scope: 'program' },
    ], rolesById)).toBeNull();
  });

  it('accepts an empty assignment list', () => {
    expect(validateRoleAssignments(1, [], rolesById)).toBeNull();
  });

  it('allows built-in roles for users without a program', () => {
    expect(validateRoleAssignments(null, [{ roleId: 1, scope: 'assigned_sites' }], rolesById)).toBeNull();
  });

  it('rejects program-wide permissions on assigned sites', () => {
    expect(validateRoleAssignments(1, [{ roleId: 5, scope: 'assigned_sites' }], rolesById))
      .toMatch(/annotation:read.*program scope/);
  });

  it('rejects roles that belong to another program', () => {
    expect(validateRoleAssignments(2, [{ roleId: 5, scope: 'program' }], rolesById))
      .toMatch(/belongs to program 1/);
    expect(validateRoleAssignments(null, [{ roleId: 5, scope: 'program' }], rolesById))
      .toMatch(/belongs to program 1/);
  });

  it('rejects unknown roles, duplicates, and bad scopes', () => {
    expect(validateRoleAssignments(1, [{ roleId: 99, scope: 'program' }], rolesById))
      .toBe('Role not found with ID: 99');
    expect(validateRoleAssignments(1, [
      { roleId: 1, scope: 'program' },
      { roleId: 1, scope: 'assigned_sites' },
    ], rolesById)).toBe('Role 1 is assigned more than once');
    expect(validateRoleAssignments(1, [{ roleId: 1, scope: 'everywhere' as any }], rolesById))
      .toMatch(/Invalid scope/);
  });
});

describe('validateRolePermissions', () => {
  it('accepts grantable permissions', () => {
    expect(validateRolePermissions(['specimen:read', 'annotation:read'])).toBeNull();
  });

  it('rejects empty, unknown, system, and duplicate permissions', () => {
    expect(validateRolePermissions([])).toMatch(/non-empty/);
    expect(validateRolePermissions(['specimen:read', 'made:up'])).toMatch(/made:up/);
    expect(validateRolePermissions(['system:admin'])).toMatch(/system:admin/);
    expect(validateRolePermissions(['site:read', 'site:read'])).toMatch(/duplicates/);
  });
});

describe('validateRoleKey', () => {
  it('accepts snake_case keys and rejects others', () => {
    expect(validateRoleKey('data_reviewer')).toBeNull();
    expect(validateRoleKey('Data Reviewer')).not.toBeNull();
    expect(validateRoleKey('1st_role')).not.toBeNull();
    expect(validateRoleKey('x')).not.toBeNull();
  });
});
