import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../db';
import { RolePermission, UserRole } from '../../db/models';
import { isProgramPermission } from '../../services/permissions';
import { serializeRole, validateRolePermissions } from '../../services/roles.service';
import { errorResponseSchema, findRoleWithPermissions, rolePermissionsBodySchema, roleResponseSchema } from './common';

interface UpdateRoleBody {
  name?: string;
  permissions?: string[];
}

export const schema = {
  tags: ['Roles'],
  description: 'Rename a custom role or replace its permissions. Changes apply to every user holding the role.',
  params: {
    type: 'object',
    required: ['role_id'],
    properties: {
      role_id: { type: 'number' },
    },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      permissions: rolePermissionsBodySchema,
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        role: roleResponseSchema,
      },
    },
    400: errorResponseSchema,
    404: errorResponseSchema,
  },
};

export async function updateRole(
  request: FastifyRequest<{ Params: { role_id: number }; Body: UpdateRoleBody }>,
  reply: FastifyReply
) {
  try {
    const { role_id: roleId } = request.params;
    const { name, permissions } = request.body;

    const role = await findRoleWithPermissions(roleId);
    if (!role) {
      return reply.code(404).send({ error: 'Role not found' });
    }
    if (role.isSystem) {
      return reply.code(400).send({ error: 'Built-in roles cannot be changed; create a custom role instead' });
    }

    if (permissions !== undefined) {
      const validationError = validateRolePermissions(permissions);
      if (validationError) {
        return reply.code(400).send({ error: validationError });
      }

      const programOnly = permissions.filter(isProgramPermission);
      if (programOnly.length > 0) {
        const siteScopedAssignments = await UserRole.count({ where: { roleId, scope: 'assigned_sites' } });
        if (siteScopedAssignments > 0) {
          return reply.code(400).send({
            error: `Role is assigned with assigned_sites scope to ${siteScopedAssignments} user(s); program-wide permissions (${programOnly.join(', ')}) require program scope`,
          });
        }
      }
    }

    await sequelize.transaction(async (transaction) => {
      if (name !== undefined) {
        await role.update({ name }, { transaction });
      }
      if (permissions !== undefined) {
        await RolePermission.destroy({ where: { roleId }, transaction });
        await RolePermission.bulkCreate(
          permissions.map((permission) => ({ roleId, permission })),
          { transaction }
        );
      }
    });

    const updated = await findRoleWithPermissions(roleId);
    return reply.send({
      message: 'Role updated successfully',
      role: serializeRole(updated!),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
