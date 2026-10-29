import { FastifyRequest, FastifyReply } from 'fastify';
import { LocationType } from '../../../db/models';
import {
  formatLocationTypeResponse,
  findProgramById,
  findDuplicateLocationTypeName,
  handleError,
  resolveLocationTypePlacement,
  validateLocationTypeParent,
} from './common';

interface CreateLocationTypeRequest {
  name: string;
  level?: number;
  parentId?: number | null;
}

export const schema = {
  tags: ['LocationTypes'],
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  body: {
    type: 'object',
    required: ['name'],
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

export async function createLocationType(
  request: FastifyRequest<{ Params: { program_id: number }; Body: CreateLocationTypeRequest }>,
  reply: FastifyReply
) {
  try {
    const { program_id } = request.params;
    const { name, level, parentId } = request.body;

    const program = await findProgramById(program_id);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    let placement;
    try {
      placement = await resolveLocationTypePlacement(program_id, parentId, level);
    } catch (error) {
      if (error instanceof Error && error.message === 'PARENT_NOT_FOUND') {
        return reply.code(400).send({ error: 'Parent location type not found in this program' });
      }
      throw error;
    }

    const parentValidationError = await validateLocationTypeParent({
      programId: program_id,
      parentId: placement.parentId,
      level: placement.level,
    });
    if (parentValidationError) {
      return reply.code(400).send({ error: parentValidationError });
    }

    const duplicate = await findDuplicateLocationTypeName(program_id, name);
    if (duplicate) {
      return reply.code(409).send({ error: 'Location type name already exists for this program' });
    }

    const locationType = await LocationType.create({
      programId: program_id,
      parentId: placement.parentId,
      name,
      level: placement.level,
    });

    return reply.code(200).send({
      message: 'Location type created successfully',
      locationType: formatLocationTypeResponse(locationType),
    });
  } catch (error) {
    return handleError(error, request, reply);
  }
}
