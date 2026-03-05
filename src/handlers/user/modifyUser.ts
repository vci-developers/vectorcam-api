import { FastifyRequest, FastifyReply } from 'fastify';
import { User, Program, Site, SiteUser } from '../../db/models';

interface ModifyUserBody {
  privilege?: number;
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
        description: 'Privilege level: 0=view selected sites, 1=view all in program, 2=write/push selected sites, 3=write/push all in program + annotate',
        enum: [0, 1, 2, 3]
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
            privilege: { type: 'number' },
            programId: { type: 'number', nullable: true },
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
    const { privilege, programId, name } = request.body;

    // Validate input
    if (!id || isNaN(parseInt(id))) {
      return reply.code(400).send({ error: 'Valid user ID is required' });
    }

    if (privilege !== undefined && ![0, 1, 2, 3].includes(privilege)) {
      return reply.code(400).send({ error: 'Invalid privilege level. Must be 0, 1, 2, or 3' });
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
    if (privilege !== undefined) {
      updateData.privilege = privilege;
    }
    if (programId !== undefined) {
      updateData.programId = programId;
    }
    if (name !== undefined) {
      updateData.name = name === null ? null : name.trim();
    }
    await user.update(updateData);

    return reply.code(200).send({
      message: 'User updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        privilege: user.privilege,
        programId: user.programId,
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
