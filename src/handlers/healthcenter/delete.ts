import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  findHealthCenterById, 
  handleError, 
  hasAssociatedSites 
} from './common';

export const schema = {
  tags: ['Health Centers'],
  description: 'Delete a health center',
  params: {
    type: 'object',
    properties: {
      healthcenter_id: { type: 'number' }
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

export async function deleteHealthCenter(
  request: FastifyRequest<{ Params: { healthcenter_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { healthcenter_id } = request.params;

    const healthCenter = await findHealthCenterById(healthcenter_id);
    if (!healthCenter) {
      return reply.code(404).send({ error: 'Health center not found' });
    }

    // Check if health center has associated sites
    const hasSites = await hasAssociatedSites(healthcenter_id);
    if (hasSites) {
      return reply.code(400).send({ 
        error: 'Health center cannot be deleted because it has associated sites' 
      });
    }

    // Delete the health center
    await healthCenter.destroy();

    reply.send({
      message: 'Health center deleted successfully',
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to delete health center');
  }
} 