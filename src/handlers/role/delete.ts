import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../db';
import { Role, RolePermission, UserRole } from '../../db/models';
import { errorResponseSchema } from './common';

export const schema = {
  tags: ['Roles'],
  description: 'Delete a custom role that is not assigned to any user',
  params: {
    type: 'object',
    required: ['role_id'],
    properties: {
      role_id: { type: 'number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
    400: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema,
  },
};

export async function deleteRole(
  request: FastifyRequest<{ Params: { role_id: number } }>,
  reply: FastifyReply
) {
  try {
    const { role_id: roleId } = request.params;

    const role = await Role.findByPk(roleId);
    if (!role) {
      return reply.code(404).send({ error: 'Role not found' });
    }
    if (role.isSystem) {
      return reply.code(400).send({ error: 'Built-in roles cannot be deleted' });
    }

    const assignmentCount = await UserRole.count({ where: { roleId } });
    if (assignmentCount > 0) {
      return reply.code(409).send({
        error: `Role is assigned to ${assignmentCount} user(s); remove those assignments first`,
      });
    }

    await sequelize.transaction(async (transaction) => {
      await RolePermission.destroy({ where: { roleId }, transaction });
      await role.destroy({ transaction });
    });
    return reply.send({ message: 'Role deleted successfully' });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
