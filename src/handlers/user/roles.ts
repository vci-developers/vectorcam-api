import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../db';
import { User } from '../../db/models';
import {
  getUserRoleAssignments,
  RoleAssignmentInput,
  RoleValidationError,
  setUserRoleAssignments,
} from '../../services/roles.service';
import { errorResponseSchema, roleAssignmentInputSchema, roleAssignmentSchema } from '../role/common';

const userIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'number' },
  },
};

const userRolesResponseSchema = {
  type: 'object',
  properties: {
    userId: { type: 'number' },
    programId: { type: ['number', 'null'] },
    privilege: { type: 'number', description: 'Deprecated: legacy level derived from roles' },
    roles: { type: 'array', items: roleAssignmentSchema },
  },
};

export const getUserRolesSchema = {
  tags: ['Users'],
  summary: 'Get a user\'s role assignments',
  params: userIdParamsSchema,
  response: {
    200: userRolesResponseSchema,
    404: errorResponseSchema,
  },
};

export const updateUserRolesSchema = {
  tags: ['Users'],
  summary: 'Replace a user\'s role assignments',
  params: userIdParamsSchema,
  body: {
    type: 'object',
    required: ['roles'],
    additionalProperties: false,
    properties: {
      roles: { type: 'array', items: roleAssignmentInputSchema },
    },
  },
  response: {
    200: userRolesResponseSchema,
    400: errorResponseSchema,
    404: errorResponseSchema,
  },
};

async function sendUserRoles(reply: FastifyReply, user: User) {
  return reply.send({
    userId: user.id,
    programId: user.programId,
    privilege: user.privilege,
    roles: await getUserRoleAssignments(user.id),
  });
}

export async function getUserRolesHandler(
  request: FastifyRequest<{ Params: { id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = await User.findByPk(request.params.id);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    return sendUserRoles(reply, user);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}

export async function updateUserRolesHandler(
  request: FastifyRequest<{ Params: { id: number }; Body: { roles: RoleAssignmentInput[] } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = await User.findByPk(request.params.id);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    try {
      await sequelize.transaction((transaction) => setUserRoleAssignments(user, request.body.roles, transaction));
    } catch (error) {
      if (error instanceof RoleValidationError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }

    return sendUserRoles(reply, user);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
