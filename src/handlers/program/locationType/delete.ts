import { FastifyRequest, FastifyReply } from 'fastify';
import { LocationType } from '../../../db/models';
import { findProgramById, handleError, hasAssociatedSites } from './common';

export const schema = {
  tags: ['LocationTypes'],
  description: 'Delete a location type',
  params: {
    type: 'object',
    required: ['program_id', 'location_type_id'],
    properties: {
      program_id: { type: 'number' },
      location_type_id: { type: 'number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
    400: {
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

export async function deleteLocationType(
  request: FastifyRequest<{ Params: { program_id: number; location_type_id: number } }>,
  reply: FastifyReply
) {
  try {
    const { program_id, location_type_id } = request.params;

    // Check if program exists
    const program = await findProgramById(program_id);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    // Check if location type exists and belongs to the program
    const locationType = await LocationType.findOne({
      where: { id: location_type_id, programId: program_id },
    });

    if (!locationType) {
      return reply.code(404).send({ error: 'Location type not found' });
    }

    // Check if location type has associated sites
    const hasSites = await hasAssociatedSites(location_type_id);
    if (hasSites) {
      return reply.code(400).send({
        error: 'Location type cannot be deleted because it has associated sites',
      });
    }

    // Delete the location type
    await locationType.destroy();

    return reply.send({
      message: 'Location type deleted successfully',
    });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to delete location type');
  }
}

