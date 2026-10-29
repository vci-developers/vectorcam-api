import { FastifyRequest, FastifyReply } from 'fastify';
import { LocationType } from '../../../db/models';
import {
  formatLocationTypeResponse,
  findProgramById,
  findDuplicateLocationTypeName,
  handleError,
  rebuildSitesForLocationType,
  resolveLocationTypePlacement,
  validateLocationTypeParent,
} from './common';

interface UpdateLocationTypeRequest {
  name?: string;
  level?: number;
  parentId?: number | null;
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
      parentId: { type: ['number', 'null'] },
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
            parentId: { type: ['number', 'null'] },
            name: { type: 'string' },
            level: { type: 'number' },
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
    409: {
      type: 'object',
      properties: {
        error: { type: 'string' },
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
    const { name, level, parentId } = request.body;

    const locationType = await LocationType.findOne({ where: { id: location_type_id, programId: program_id } });
    if (!locationType) {
      return reply.code(404).send({ error: 'Location type not found' });
    }

    const program = await findProgramById(program_id);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const nextName = name !== undefined ? name : locationType.name;

    let nextParentId = parentId !== undefined ? parentId : locationType.parentId;
    let nextLevel = level !== undefined ? level : locationType.level;

    if (parentId !== undefined) {
      if (parentId === null) {
        nextParentId = null;
        nextLevel = level !== undefined ? level : 1;
      } else {
        try {
          const placement = await resolveLocationTypePlacement(program_id, parentId, level);
          nextParentId = placement.parentId;
          nextLevel = placement.level;
        } catch (error) {
          if (error instanceof Error && error.message === 'PARENT_NOT_FOUND') {
            return reply.code(400).send({ error: 'Parent location type not found in this program' });
          }
          throw error;
        }
      }
    } else if (level !== undefined && level !== locationType.level) {
      return reply.code(400).send({ error: 'Update parentId when changing location type level' });
    }

    const parentValidationError = await validateLocationTypeParent({
      programId: program_id,
      locationTypeId: location_type_id,
      parentId: nextParentId,
      level: nextLevel,
    });
    if (parentValidationError) {
      return reply.code(400).send({ error: parentValidationError });
    }

    const duplicate = await findDuplicateLocationTypeName(program_id, nextName, location_type_id);
    if (duplicate) {
      return reply.code(409).send({ error: 'Location type name already exists for this program' });
    }

    await locationType.update({
      programId: program_id,
      parentId: nextParentId,
      name: nextName,
      level: nextLevel,
    });

    await rebuildSitesForLocationType(locationType.id);

    return reply.code(200).send({
      message: 'Location type updated successfully',
      locationType: formatLocationTypeResponse(locationType),
    });
  } catch (error) {
    return handleError(error, request, reply);
  }
}
