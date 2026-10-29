import { FastifyRequest, FastifyReply } from 'fastify';
import { Program } from '../../../../db/models';
import { programFormResponseSchema } from '../../form/common';
import {
  fetchFormVersionWithQuestions,
  resolveProgramFormRouteContext,
  sendFormVersionResponse,
} from '../common';

export const schema = {
  tags: ['Programs'],
  description: 'Get a form version with questions for a logical program form',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      program_form_id: { type: 'string' },
      version: { type: 'string' },
    },
    required: ['program_id', 'program_form_id', 'version'],
  },
  response: {
    200: programFormResponseSchema,
  },
};

export async function getProgramFormVersion(
  request: FastifyRequest<{
    Params: { program_id: string; program_form_id: string; version: string };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const context = await resolveProgramFormRouteContext(request, reply, request.params);
    if (!context) {
      return;
    }

    const program = await Program.findByPk(context.programId);
    const form = await fetchFormVersionWithQuestions(
      context.programFormId,
      request.params.version,
      program
    );

    if (!form) {
      return reply.code(404).send({ error: 'Form version not found' });
    }

    return sendFormVersionResponse(reply, form);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to get form version' });
  }
}
