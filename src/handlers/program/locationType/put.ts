import { FastifyRequest, FastifyReply } from 'fastify';
import { LocationType } from '../../../db/models';
import { formatLocationTypeResponse, findProgramById, handleError, rebuildSitesForLocationType } from './common';

interface UpdateLocationTypeRequest {
  name?: string;
  level?: number;
}

export const schema = {
  tags: ['LocationTypes'],
  params: {
    type: 'object',
    required: ['program_id', 'location_type_id'],
    properties: {
      program_id: { type: 'number' },
      location_type_id: { type: 'number' },
    },
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      level: { type: 'number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        locationType: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            programId: { type: 'number' },
            name: { type: 'string' },
            level: { type: 'number' },
          },
        },
      },
    },
  },
};

export async function updateLocationType(
  request: FastifyRequest<{ Params: { program_id: number; location_type_id: number }; Body: UpdateLocationTypeRequest }>,
  reply: FastifyReply
) {
  try {
    const { program_id, location_type_id } = request.params;
    const { name, level } = request.body;

    const locationType = await LocationType.findOne({ where: { id: location_type_id, programId: program_id } });
    if (!locationType) {
      return reply.code(404).send({ error: 'Location type not found' });
    }

    const program = await findProgramById(program_id);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    await locationType.update({
      programId: program_id,
      name: name !== undefined ? name : locationType.name,
      level: level !== undefined ? level : locationType.level,
    });

    // Rebuild location hierarchy for all sites using this location type
    await rebuildSitesForLocationType(locationType.id);

    return reply.code(200).send({
      message: 'Location type updated successfully',
      locationType: formatLocationTypeResponse(locationType),
    });
  } catch (error) {
    return handleError(error, request, reply);
  }
}


