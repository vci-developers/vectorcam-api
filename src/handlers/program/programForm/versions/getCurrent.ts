import { FastifyRequest, FastifyReply } from 'fastify';
import { Program } from '../../../../db/models';
import { programFormResponseSchema } from '../../form/common';
import {
  fetchCurrentPublishedFormVersion,
  resolveProgramFormRouteContext,
  sendFormVersionResponse,
} from '../common';

export const schema = {
  tags: ['Programs'],
  description: 'Get the current published form version for a logical program form',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      program_form_id: { type: 'string' },
    },
    required: ['program_id', 'program_form_id'],
  },
  response: {
    200: programFormResponseSchema,
  },
};

export async function getProgramFormVersionCurrent(
  request: FastifyRequest<{ Params: { program_id: string; program_form_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const context = await resolveProgramFormRouteContext(request, reply, request.params);
    if (!context) {
      return;
    }

    const program = await Program.findByPk(context.programId);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const result = await fetchCurrentPublishedFormVersion(context.programFormId, program);
    if ('error' in result) {
      if (result.error === 'invalid_pointer') {
        return reply.code(400).send({ error: 'Program formVersion pointer is invalid or points to draft' });
      }
      return reply.code(404).send({ error: 'No published form version found' });
    }

    return sendFormVersionResponse(reply, result.form);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to get current form version' });
  }
}
