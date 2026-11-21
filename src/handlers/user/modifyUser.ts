import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../db';
import { User, Program, Site, SiteUser } from '../../db/models';
import {
  getUserRoleAssignments,
  legacyPrivilegeAssignment,
  RoleAssignmentInput,
  RoleValidationError,
  setUserRoleAssignments,
} from '../../services/roles.service';
import { roleAssignmentInputSchema, roleAssignmentSchema } from '../role/common';

interface ModifyUserBody {
  privilege?: number;
  roles?: RoleAssignmentInput[];
  isDeveloper?: boolean;
  programId?: number;
  name?: string | null;
}

interface ModifyUserParams {
  id: string;
}

export const modifyUserSchema: any = {
  tags: ['Users'],
  summary: 'Modify user',
  description: 'Modify user fields (admin auth token required)',
  headers: {
    type: 'object',
    properties: {
      authorization: { type: 'string', description: 'Bearer admin-auth-token' },
    },
    required: ['authorization'],
  },
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'User ID' },
    },
    required: ['id'],
  },
  body: {
    type: 'object',
    properties: {
      privilege: { 
        type: 'number',
        description: 'Deprecated, use roles. Replaces the user\'s roles with the matching built-in role: 0=Viewer on assigned sites, 1=Viewer for the program, 2=Editor on assigned sites, 3=Program Manager, 4=Program Admin',
        enum: [0, 1, 2, 3, 4]
      },
      roles: {
        type: 'array',
        items: roleAssignmentInputSchema,
        description: 'Role assignments that replace the user\'s current roles. Cannot be combined with privilege.'
      },
      isDeveloper: {
        type: 'boolean',
        description: 'Developer flag: grants every permission in every program, like the admin token.'
      },
      programId: {
        type: 'number',
        description: 'Optional program ID to assign the user to. All site access will be scoped to this program.'
      },
      name: {
        type: ['string', 'null'],
        description: 'Optional display name for the user.'
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            name: { type: ['string', 'null'] },
            privilege: { type: 'number', description: 'Deprecated: legacy level derived from roles' },
            isDeveloper: { type: 'boolean' },
            programId: { type: 'number', nullable: true },
            roles: { type: 'array', items: roleAssignmentSchema },
            isActive: { type: 'boolean' },
            updatedAt: { type: 'string' },
          },
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    401: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

/**
 * Modify user handler
 * Requires admin auth token
 */
export async function modifyUserHandler(
  request: FastifyRequest<{ Body: ModifyUserBody; Params: ModifyUserParams }>, 
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params;
    const { privilege, roles, isDeveloper, programId, name } = request.body;

    // Validate input
    if (!id || isNaN(parseInt(id))) {
      return reply.code(400).send({ error: 'Valid user ID is required' });
    }

    if (privilege !== undefined && ![0, 1, 2, 3, 4].includes(privilege)) {
      return reply.code(400).send({ error: 'Invalid privilege level. Must be 0, 1, 2, 3, or 4' });
    }
    if (privilege !== undefined && roles !== undefined) {
      return reply.code(400).send({ error: 'Provide either roles or privilege, not both' });
    }

    // Validate programId if provided
    if (programId !== undefined) {
      const program = await Program.findByPk(programId);
      if (!program) {
        return reply.code(400).send({ error: `Program not found with ID: ${programId}` });
      }
    }

    // Find user by ID
    const user = await User.findByPk(parseInt(id));
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // If program is changing, reject if stale site access exists outside target program.
    if (programId !== undefined && user.programId !== programId) {
      const existingSiteAccess = await SiteUser.findAll({
        where: { userId: user.id },
        include: [
          {
            model: Site,
            as: 'site',
            attributes: ['id', 'programId'],
            required: true
          }
        ]
      });

      const invalidSiteIds = existingSiteAccess
        .filter(siteUser => {
          const site = siteUser.get('site') as Site | undefined;
          return !!site && site.programId !== programId;
        })
        .map(siteUser => siteUser.siteId);

      if (invalidSiteIds.length > 0) {
        return reply.code(400).send({
          error: `Cannot change program. User has site access outside program ${programId}: ${invalidSiteIds.join(', ')}. Remove these site assignments first.`
        });
      }
    }

    // Update only fields provided in request body
    const updateData: any = {};
    if (isDeveloper !== undefined) {
      updateData.isDeveloper = isDeveloper;
    }
    if (programId !== undefined) {
      updateData.programId = programId;
    }
    if (name !== undefined) {
      updateData.name = name === null ? null : name.trim();
    }

    try {
      await sequelize.transaction(async (transaction) => {
        await user.update(updateData, { transaction });

        const assignments = roles
          ?? (privilege !== undefined ? [await legacyPrivilegeAssignment(privilege, transaction)] : undefined);
        if (assignments) {
          await setUserRoleAssignments(user, assignments, transaction);
          return;
        }

        const otherProgramRoles = (await getUserRoleAssignments(user.id, transaction))
          .filter((assignment) => assignment.programId !== null && assignment.programId !== user.programId);
        if (otherProgramRoles.length > 0) {
          throw new RoleValidationError(
            `Cannot change program. User holds roles of another program: ${otherProgramRoles.map((role) => role.key).join(', ')}. Replace the user's roles in the same request.`
          );
        }
      });
    } catch (error) {
      if (error instanceof RoleValidationError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }

    return reply.code(200).send({
      message: 'User updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        privilege: user.privilege,
        isDeveloper: user.isDeveloper,
        programId: user.programId,
        roles: await getUserRoleAssignments(user.id),
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
