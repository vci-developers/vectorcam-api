import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findSiteById, 
  handleError, 
  hasAssociatedSessions,
  hasChildSites,
} from './common';

export const schema = {
  tags: ['Sites'],
  description: 'Delete a site',
  params: {
    type: 'object',
    properties: {
      site_id: { type: 'number' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
};

export async function deleteSite(
  request: FastifyRequest<{ Params: { site_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { site_id } = request.params;

    const site = await findSiteById(site_id);
    if (!site) {
      return reply.code(404).send({ error: 'Site not found' });
    }

    // Check if site has associated sessions
    const hasSessions = await hasAssociatedSessions(site_id);
    if (hasSessions) {
      return reply.code(400).send({ 
        error: 'Site cannot be deleted because it has associated sessions' 
      });
    }

    // Check if site has child sites
    const hasChildren = await hasChildSites(site_id);
    if (hasChildren) {
      return reply.code(400).send({
        error: 'Site cannot be deleted because it has child sites',
      });
    }

    // Delete the site
    await site.destroy();

    return reply.send({
      message: 'Site deleted successfully',
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to delete site');
  }
} 