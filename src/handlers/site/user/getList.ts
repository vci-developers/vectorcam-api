import { FastifyRequest, FastifyReply } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { SiteUser, User, Site } from '../../../db/models';

// Schema
export const getSiteUsersSchema = {
  tags: ['Site Users'],
  summary: 'Get site users',
  description: 'Get all admin users for a site with pagination (requires admin token)',
  params: Type.Object({
    siteId: Type.String()
  }),
  querystring: Type.Object({
    page: Type.Optional(Type.String()),
    limit: Type.Optional(Type.String())
  }),
  response: {
    200: Type.Object({
      data: Type.Array(Type.Object({
        id: Type.Number(),
        userId: Type.Number(),
        siteId: Type.Number(),
        createdAt: Type.Number(),
        updatedAt: Type.Number(),
        user: Type.Object({
          id: Type.Number(),
          email: Type.String(),
          privilege: Type.Number(),
          isActive: Type.Boolean()
        })
      })),
      pagination: Type.Object({
        page: Type.Number(),
        limit: Type.Number(),
        total: Type.Number(),
        totalPages: Type.Number()
      })
    }),
    403: Type.Object({
      error: Type.String()
    }),
    404: Type.Object({
      error: Type.String()
    })
  }
};

type GetSiteUsersRequest = FastifyRequest<{
  Params: Static<typeof getSiteUsersSchema.params>;
  Querystring: Static<typeof getSiteUsersSchema.querystring>;
}>;

// Get all admin users for a site
export async function getSiteUsersHandler(
  request: GetSiteUsersRequest,
  reply: FastifyReply
) {
  try {
    const { siteId } = request.params;
    const { page = '1', limit = '10' } = request.query;

    const siteIdNum = parseInt(siteId);
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    // Admin auth middleware handles authentication, no additional checks needed

    // Verify site exists
    const site = await Site.findByPk(siteIdNum);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    // Get site users with pagination
    const { count, rows: siteUsers } = await SiteUser.findAndCountAll({
      where: { siteId: siteIdNum },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'privilege', 'isActive']
      }],
      limit: limitNum,
      offset: offset,
      order: [['createdAt', 'DESC']]
    });

    const totalPages = Math.ceil(count / limitNum);

    const formattedSiteUsers = siteUsers.map(siteUser => ({
      id: siteUser.id,
      userId: siteUser.userId,
      siteId: siteUser.siteId,
      createdAt: siteUser.createdAt.getTime(),
      updatedAt: siteUser.updatedAt.getTime(),
      user: {
        id: (siteUser as any).user.id,
        email: (siteUser as any).user.email,
        privilege: (siteUser as any).user.privilege,
        isActive: (siteUser as any).user.isActive
      }
    }));

    return reply.code(200).send({
      data: formattedSiteUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        totalPages
      }
    });

  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
