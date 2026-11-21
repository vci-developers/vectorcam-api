import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../db';
import { Program, Role, RolePermission } from '../../db/models';
import { serializeRole, validateRoleKey, validateRolePermissions } from '../../services/roles.service';
import { errorResponseSchema, findRoleWithPermissions, rolePermissionsBodySchema, roleResponseSchema } from './common';

interface CreateRoleBody {
  key: string;
  name: string;
  programId?: number | null;
  permissions: string[];
}

export const schema = {
  tags: ['Roles'],
  description: 'Create a custom role',
  body: {
    type: 'object',
    required: ['key', 'name', 'permissions'],
    additionalProperties: false,
    properties: {
      key: { type: 'string', description: 'Stable identifier, e.g. data_reviewer' },
      name: { type: 'string', minLength: 1, maxLength: 255 },
      programId: {
        type: ['number', 'null'],
        description: 'Limit the role to users of one program. Omit to make it available to every program.',
      },
      permissions: rolePermissionsBodySchema,
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        role: roleResponseSchema,
      },
    },
    400: errorResponseSchema,
    409: errorResponseSchema,
  },
};

export async function createRole(
  request: FastifyRequest<{ Body: CreateRoleBody }>,
  reply: FastifyReply
) {
  try {
    const { key, name, programId = null, permissions } = request.body;

    const validationError = validateRoleKey(key) ?? validateRolePermissions(permissions);
    if (validationError) {
      return reply.code(400).send({ error: validationError });
    }

    if (programId !== null && !(await Program.findByPk(programId))) {
      return reply.code(400).send({ error: `Program not found with ID: ${programId}` });
    }

    if (await Role.findOne({ where: { key } })) {
      return reply.code(409).send({ error: `A role with key "${key}" already exists` });
    }

    const roleId = await sequelize.transaction(async (transaction) => {
      const role = await Role.create({ key, name, programId, isSystem: false }, { transaction });
      await RolePermission.bulkCreate(
        permissions.map((permission) => ({ roleId: role.id, permission })),
        { transaction }
      );
      return role.id;
    });

    const role = await findRoleWithPermissions(roleId);
    return reply.code(201).send({
      message: 'Role created successfully',
      role: serializeRole(role!),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
