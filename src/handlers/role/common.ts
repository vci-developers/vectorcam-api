import { Transaction } from 'sequelize';
import { Role, RolePermission } from '../../db/models';
import { ASSIGNMENT_SCOPES, GRANTABLE_PERMISSIONS } from '../../services/permissions';

export const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
};

export const roleResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    key: { type: 'string' },
    name: { type: 'string' },
    programId: { type: ['number', 'null'] },
    isSystem: { type: 'boolean' },
    permissions: { type: 'array', items: { type: 'string' } },
  },
};

export const rolePermissionsBodySchema = {
  type: 'array',
  minItems: 1,
  uniqueItems: true,
  items: { type: 'string', enum: [...GRANTABLE_PERMISSIONS] },
};

export const roleAssignmentInputSchema = {
  type: 'object',
  required: ['roleId', 'scope'],
  additionalProperties: false,
  properties: {
    roleId: { type: 'number' },
    scope: {
      type: 'string',
      enum: [...ASSIGNMENT_SCOPES],
      description: 'program = every site in the user\'s program; assigned_sites = the user\'s assigned sites and their child sites',
    },
  },
};

export const roleAssignmentSchema = {
  type: 'object',
  properties: {
    roleId: { type: 'number' },
    key: { type: 'string' },
    name: { type: 'string' },
    programId: { type: ['number', 'null'] },
    isSystem: { type: 'boolean' },
    scope: { type: 'string' },
  },
};

export async function findRoleWithPermissions(id: number, transaction?: Transaction): Promise<Role | null> {
  return Role.findByPk(id, {
    include: [{ model: RolePermission, as: 'permissions', attributes: ['roleId', 'permission'] }],
    transaction,
  });
}
