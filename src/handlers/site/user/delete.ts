import { FastifyRequest, FastifyReply } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { SiteUser, User } from '../../../db/models';

// Schema
export const deleteSiteUserSchema = {
  tags: ['Site Users'],
  summary: 'Remove user from site',
  description: 'Remove an admin user from a site (requires admin token)',
  params: Type.Object({
    siteId: Type.String(),
    userId: Type.String()
  }),
  response: {
    200: Type.Object({
      success: Type.Boolean(),
      message: Type.String()
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

type DeleteSiteUserRequest = FastifyRequest<{
  Params: Static<typeof deleteSiteUserSchema.params>;
}>;

// Remove admin user from site
export async function deleteSiteUserHandler(
  request: DeleteSiteUserRequest,
  reply: FastifyReply
) {
  try {
    const { siteId, userId } = request.params;

    const siteIdNum = parseInt(siteId);
    const userIdNum = parseInt(userId);

    // Find and delete the site user association
    const deleted = await SiteUser.destroy({
      where: { userId: userIdNum, siteId: siteIdNum }
    });

    if (deleted === 0) {
      return reply.status(404).send({
        success: false,
        error: 'Site user association not found'
      });
    }

    return reply.status(200).send({
      success: true,
      message: 'Site user association removed successfully'
    });

  } catch (error: any) {
    request.log.error('Error deleting site user:', error);
    return reply.status(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
}
