import { FastifyRequest, FastifyReply } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { SiteUser, User, Site } from '../../../db/models';

// Schema
export const addSiteUserSchema = {
  tags: ['Site Users'],
  summary: 'Add user to site',
  description: 'Add an admin user to a site (requires admin token)',
  params: Type.Object({
    siteId: Type.String()
  }),
  body: Type.Object({
    userId: Type.Number()
  }),
  response: {
    200: Type.Object({
      success: Type.Boolean(),
      data: Type.Object({
        id: Type.Number(),
        userId: Type.Number(),
        siteId: Type.Number(),
        createdAt: Type.String(),
        updatedAt: Type.String()
      })
    }),
    400: Type.Object({
      success: Type.Boolean(),
      error: Type.String()
    }),
    403: Type.Object({
      success: Type.Boolean(),
      error: Type.String()
    }),
    404: Type.Object({
      success: Type.Boolean(),
      error: Type.String()
    })
  }
};

type AddSiteUserRequest = FastifyRequest<{
  Params: Static<typeof addSiteUserSchema.params>;
  Body: Static<typeof addSiteUserSchema.body>;
}>;

// Add admin user to site
export async function addSiteUserHandler(
  request: AddSiteUserRequest,
  reply: FastifyReply
) {
  try {
    const { siteId } = request.params;
    const { userId } = request.body;

    const siteIdNum = parseInt(siteId);

    // Verify site exists
    const site = await Site.findByPk(siteIdNum);
    if (!site) {
      return reply.status(404).send({
        success: false,
        error: 'Site not found'
      });
    }

    // Verify user exists and is admin (privilege = 1)
    const user = await User.findByPk(userId);
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: 'User not found'
      });
    }

    if (user.privilege !== 1) {
      return reply.status(400).send({
        success: false,
        error: 'Only admin users (privilege = 1) can be assigned to sites'
      });
    }

    // Check if association already exists
    const existingAssociation = await SiteUser.findOne({
      where: { userId, siteId: siteIdNum }
    });

    if (existingAssociation) {
      return reply.status(400).send({
        success: false,
        error: 'User is already assigned to this site'
      });
    }

    // Create the association
    const siteUser = await SiteUser.create({
      userId,
      siteId: siteIdNum
    });

    return reply.status(200).send({
      success: true,
      data: {
        id: siteUser.id,
        userId: siteUser.userId,
        siteId: siteUser.siteId,
        createdAt: siteUser.createdAt.toISOString(),
        updatedAt: siteUser.updatedAt.toISOString()
      }
    });

  } catch (error: any) {
    request.log.error('Error adding site user:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
}
