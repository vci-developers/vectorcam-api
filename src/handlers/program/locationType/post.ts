import { FastifyRequest, FastifyReply } from 'fastify';
import { LocationType } from '../../../db/models';
import { formatLocationTypeResponse, findProgramById, handleError } from './common';

interface CreateLocationTypeRequest {
  name: string;
  level?: number;
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

export async function createLocationType(
  request: FastifyRequest<{ Params: { program_id: number }; Body: CreateLocationTypeRequest }>,
  reply: FastifyReply
) {
  try {
    const { program_id } = request.params;
    const { name, level } = request.body;

    const program = await findProgramById(program_id);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    // If level not provided, assign next level in sequence for this program
    let assignedLevel = level;
    if (assignedLevel === undefined) {
      const maxLevel = await LocationType.max('level', { where: { programId: program_id } }) as number | null;
      assignedLevel = (maxLevel ?? 0) + 1;
    }

    const locationType = await LocationType.create({
      programId: program_id,
      name,
      level: assignedLevel,
    });

    return reply.code(200).send({
      message: 'Location type created successfully',
      locationType: formatLocationTypeResponse(locationType),
    });
  } catch (error) {
    return handleError(error, request, reply);
  }
}


