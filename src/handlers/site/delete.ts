import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findSiteById, 
  handleError, 
  hasAssociatedDevices,
  hasAssociatedSessions 
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

    // Check if site has associated devices
    const hasDevices = await hasAssociatedDevices(site_id);
    if (hasDevices) {
      return reply.code(400).send({ 
        error: 'Site cannot be deleted because it has associated devices' 
      });
    }

    // Check if site has associated sessions
    const hasSessions = await hasAssociatedSessions(site_id);
    if (hasSessions) {
      return reply.code(400).send({ 
        error: 'Site cannot be deleted because it has associated sessions' 
      });
    }

    // Delete the site
    await site.destroy();

    reply.send({
      message: 'Site deleted successfully',
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to delete site');
  }
} 