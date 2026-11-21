import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { Role, RolePermission } from '../../db/models';
import { serializeRole } from '../../services/roles.service';
import { PROGRAM_PERMISSIONS, SITE_PERMISSIONS } from '../../services/permissions';
import { roleResponseSchema } from './common';

export const schema = {
  tags: ['Roles'],
  description: 'List built-in and custom roles, plus the permission catalog roles are built from',
  querystring: {
    type: 'object',
    properties: {
      programId: {
        type: 'number',
        description: 'Only return roles that can be assigned to users of this program',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        roles: { type: 'array', items: roleResponseSchema },
        catalog: {
          type: 'object',
          properties: {
            sitePermissions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Apply to the sites covered by the assignment scope',
            },
            programPermissions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Apply to the whole program; only effective with program scope',
            },
          },
        },
      },
    },
  },
};

export async function getRoleList(
  request: FastifyRequest<{ Querystring: { programId?: number } }>,
  reply: FastifyReply
) {
  try {
    const { programId } = request.query;
    const roles = await Role.findAll({
      where: programId !== undefined ? { [Op.or]: [{ programId: null }, { programId }] } : {},
      include: [{ model: RolePermission, as: 'permissions', attributes: ['roleId', 'permission'] }],
      order: [['isSystem', 'DESC'], ['id', 'ASC']],
    });

    return reply.send({
      roles: roles.map(serializeRole),
      catalog: {
        sitePermissions: [...SITE_PERMISSIONS],
        programPermissions: [...PROGRAM_PERMISSIONS],
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
}
