import { Op, Transaction } from 'sequelize';
import { Role, RolePermission, User, UserRole } from '../db/models';
import {
  AssignmentScope,
  BUILT_IN_ROLES,
  BuiltInRoleKey,
  GRANTABLE_PERMISSIONS,
  isAssignmentScope,
  isGrantablePermission,
  isProgramPermission,
  LEGACY_PRIVILEGE_ASSIGNMENTS,
  legacyPrivilegeFor,
  Permission,
} from './permissions';

export class RoleValidationError extends Error {}

export interface RoleAssignmentInput {
  roleId: number;
  scope: AssignmentScope;
}

export interface RoleSummary {
  id: number;
  key: string;
  name: string;
  programId: number | null;
  permissions: string[];
}

export interface SerializedRole extends RoleSummary {
  isSystem: boolean;
}

export interface SerializedRoleAssignment {
  roleId: number;
  key: string;
  name: string;
  programId: number | null;
  isSystem: boolean;
  scope: AssignmentScope;
}

const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

const rolePermissionsInclude = { model: RolePermission, as: 'permissions', attributes: ['roleId', 'permission'] };

function sortPermissions(permissions: string[]): string[] {
  const order = new Map<string, number>(GRANTABLE_PERMISSIONS.map((permission, index) => [permission, index]));
  return [...permissions].sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity));
}

export function serializeRole(role: Role): SerializedRole {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    programId: role.programId ?? null,
    isSystem: role.isSystem,
    permissions: sortPermissions((role.permissions ?? []).map((rolePermission) => rolePermission.permission)),
  };
}

export function validateRolePermissions(permissions: unknown): string | null {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return 'permissions must be a non-empty array';
  }
  const invalid = permissions.filter((permission) => typeof permission !== 'string' || !isGrantablePermission(permission));
  if (invalid.length > 0) {
    return `Unknown or non-grantable permissions: ${invalid.join(', ')}`;
  }
  if (new Set(permissions).size !== permissions.length) {
    return 'permissions must not contain duplicates';
  }
  return null;
}

export function validateRoleKey(key: unknown): string | null {
  if (typeof key !== 'string' || !ROLE_KEY_PATTERN.test(key)) {
    return 'key must be 2-64 characters of lowercase letters, digits, or underscores, starting with a letter';
  }
  return null;
}

/**
 * Checks a full set of assignments for one user. Program-wide permissions can only be
 * granted with program scope, and program-specific roles only to users of that program.
 * Users without a program may hold built-in roles; they take effect once a program is set.
 */
export function validateRoleAssignments(
  programId: number | null,
  inputs: RoleAssignmentInput[],
  rolesById: ReadonlyMap<number, RoleSummary>
): string | null {
  const seen = new Set<number>();
  for (const input of inputs) {
    if (!Number.isInteger(input.roleId)) {
      return 'roleId must be an integer';
    }
    if (seen.has(input.roleId)) {
      return `Role ${input.roleId} is assigned more than once`;
    }
    seen.add(input.roleId);

    if (!isAssignmentScope(input.scope)) {
      return `Invalid scope "${input.scope}". Must be "program" or "assigned_sites"`;
    }

    const role = rolesById.get(input.roleId);
    if (!role) {
      return `Role not found with ID: ${input.roleId}`;
    }
    if (role.programId !== null && role.programId !== programId) {
      return `Role "${role.key}" belongs to program ${role.programId} and can only be assigned to users of that program`;
    }
    if (input.scope === 'assigned_sites') {
      const programOnly = role.permissions.filter(isProgramPermission);
      if (programOnly.length > 0) {
        return `Role "${role.key}" includes program-wide permissions (${programOnly.join(', ')}) and can only be assigned with program scope`;
      }
    }
  }

  return null;
}

async function findRoleSummaries(roleIds: number[], transaction?: Transaction): Promise<Map<number, RoleSummary>> {
  if (roleIds.length === 0) {
    return new Map();
  }
  const roles = await Role.findAll({
    where: { id: Array.from(new Set(roleIds)) },
    include: [rolePermissionsInclude],
    transaction,
  });
  return new Map(roles.map((role) => [role.id, serializeRole(role)]));
}

/**
 * Replaces all of a user's role assignments. Also keeps the deprecated `users.privilege`
 * column in step for clients that still read it.
 */
export async function setUserRoleAssignments(
  user: User,
  inputs: RoleAssignmentInput[],
  transaction?: Transaction
): Promise<void> {
  const rolesById = await findRoleSummaries(inputs.map((input) => input.roleId), transaction);
  const error = validateRoleAssignments(user.programId, inputs, rolesById);
  if (error) {
    throw new RoleValidationError(error);
  }

  await UserRole.destroy({ where: { userId: user.id }, transaction });
  if (inputs.length > 0) {
    await UserRole.bulkCreate(
      inputs.map((input) => ({ userId: user.id, roleId: input.roleId, scope: input.scope })),
      { transaction }
    );
  }

  const privilege = legacyPrivilegeFor(
    inputs.flatMap((input) =>
      rolesById.get(input.roleId)!.permissions.map((permission) => ({ permission, scope: input.scope }))
    )
  );
  await user.update({ privilege }, { transaction });
}

/** The built-in assignment equivalent to a legacy privilege level. */
export async function legacyPrivilegeAssignment(
  privilege: number,
  transaction?: Transaction
): Promise<RoleAssignmentInput> {
  const legacy = LEGACY_PRIVILEGE_ASSIGNMENTS[privilege];
  if (!legacy) {
    throw new RoleValidationError('Invalid privilege level. Must be 0, 1, 2, 3, or 4');
  }
  const role = await Role.findOne({ where: { key: legacy.roleKey, isSystem: true }, transaction });
  if (!role) {
    throw new Error(`Built-in role "${legacy.roleKey}" is missing. Run scripts/create-roles-tables.ts`);
  }
  return { roleId: role.id, scope: legacy.scope };
}

/** New accounts start with the equivalent of legacy privilege 0: Viewer on assigned sites. */
export async function assignDefaultRole(user: User, transaction?: Transaction): Promise<void> {
  const assignment = await legacyPrivilegeAssignment(0, transaction);
  await setUserRoleAssignments(user, [assignment], transaction);
}

export async function getUserRoleAssignments(
  userId: number,
  transaction?: Transaction
): Promise<SerializedRoleAssignment[]> {
  const assignments = await UserRole.findAll({
    where: { userId },
    include: [{ model: Role, as: 'role', required: true }],
    order: [['roleId', 'ASC']],
    transaction,
  });
  return assignments.map((assignment) => ({
    roleId: assignment.roleId,
    key: assignment.role!.key,
    name: assignment.role!.name,
    programId: assignment.role!.programId ?? null,
    isSystem: assignment.role!.isSystem,
    scope: assignment.scope,
  }));
}

/** Active users of a program who hold a program-wide permission through their roles. */
export async function findActiveUsersWithProgramPermission(
  programId: number,
  permission: Permission,
  transaction?: Transaction
): Promise<User[]> {
  const assignments = await UserRole.findAll({
    where: { scope: 'program' },
    attributes: ['userId', 'roleId'],
    include: [{
      model: Role,
      as: 'role',
      required: true,
      attributes: ['id'],
      where: { [Op.or]: [{ programId: null }, { programId }] },
      include: [{
        model: RolePermission,
        as: 'permissions',
        required: true,
        attributes: ['roleId', 'permission'],
        where: { permission },
      }],
    }],
    transaction,
  });

  const userIds = Array.from(new Set(assignments.map((assignment) => assignment.userId)));
  if (userIds.length === 0) {
    return [];
  }

  return User.findAll({
    where: { id: userIds, programId, isActive: true },
    order: [['id', 'ASC']],
    transaction,
  });
}

/** Creates or updates the built-in roles so their permissions match the code definitions. */
export async function syncBuiltInRoles(transaction?: Transaction): Promise<Map<BuiltInRoleKey, number>> {
  const roleIds = new Map<BuiltInRoleKey, number>();

  for (const definition of BUILT_IN_ROLES) {
    let role = await Role.findOne({ where: { key: definition.key }, transaction });
    if (!role) {
      role = await Role.create(
        { key: definition.key, name: definition.name, programId: null, isSystem: true },
        { transaction }
      );
    } else if (role.name !== definition.name || !role.isSystem || role.programId !== null) {
      await role.update({ name: definition.name, programId: null, isSystem: true }, { transaction });
    }

    await RolePermission.destroy({ where: { roleId: role.id }, transaction });
    await RolePermission.bulkCreate(
      definition.permissions.map((permission) => ({ roleId: role!.id, permission })),
      { transaction }
    );
    roleIds.set(definition.key, role.id);
  }

  return roleIds;
}

/**
 * Gives every user without role assignments the built-in assignment matching their
 * legacy privilege level. Returns the number of users backfilled.
 */
export async function backfillLegacyRoleAssignments(transaction?: Transaction): Promise<number> {
  const roleIds = await syncBuiltInRoles(transaction);
  const [users, existingAssignments] = await Promise.all([
    User.findAll({ attributes: ['id', 'privilege'], transaction }),
    UserRole.findAll({ attributes: ['userId'], transaction }),
  ]);

  const usersWithRoles = new Set(existingAssignments.map((assignment) => assignment.userId));
  const rows = users
    .filter((user) => !usersWithRoles.has(user.id))
    .map((user) => {
      const legacy = LEGACY_PRIVILEGE_ASSIGNMENTS[user.privilege] ?? LEGACY_PRIVILEGE_ASSIGNMENTS[0];
      return { userId: user.id, roleId: roleIds.get(legacy.roleKey)!, scope: legacy.scope };
    });

  if (rows.length > 0) {
    await UserRole.bulkCreate(rows, { transaction });
  }
  return rows.length;
}
