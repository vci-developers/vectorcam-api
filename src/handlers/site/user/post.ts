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
      data: Type.Object({
        id: Type.Number(),
        userId: Type.Number(),
        siteId: Type.Number(),
        createdAt: Type.Number(),
        updatedAt: Type.Number()
      })
    }),
    400: Type.Object({
      error: Type.String()
    }),
    403: Type.Object({
      error: Type.String()
    }),
    404: Type.Object({
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
      return reply.code(404).send({ error: 'Site not found' });
    }

    // Verify user exists and is admin (privilege = 1)
    const user = await User.findByPk(userId);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    if (user.privilege !== 1) {
      return reply.code(400).send({ error: 'Only admin users (privilege = 1) can be assigned to sites' });
    }

    // Check if association already exists
    const existingAssociation = await SiteUser.findOne({
      where: { userId, siteId: siteIdNum }
    });

    if (existingAssociation) {
      return reply.code(400).send({ error: 'User is already assigned to this site' });
    }

    // Create the association
    const siteUser = await SiteUser.create({
      userId,
      siteId: siteIdNum
    });

    return reply.code(200).send({
      data: {
        id: siteUser.id,
        userId: siteUser.userId,
        siteId: siteUser.siteId,
        createdAt: siteUser.createdAt.getTime(),
        updatedAt: siteUser.updatedAt.getTime()
      }
    });

  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
