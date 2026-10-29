import { FastifyRequest, FastifyReply } from 'fastify';
import { Form } from '../../../../db/models';
import {
  programFormVersionSummarySchema,
  resolveProgramFormRouteContext,
} from '../common';

export const schema = {
  tags: ['Programs'],
  description: 'List version snapshots for a logical program form',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      program_form_id: { type: 'string' },
    },
    required: ['program_id', 'program_form_id'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        forms: {
          type: 'array',
          items: programFormVersionSummarySchema,
        },
      },
    },
  },
};

export async function listProgramFormVersions(
  request: FastifyRequest<{ Params: { program_id: string; program_form_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const context = await resolveProgramFormRouteContext(request, reply, request.params);
    if (!context) {
      return;
    }

    const forms = await Form.findAll({
      where: { programFormId: context.programFormId },
      order: [['updatedAt', 'DESC']],
    });

    return reply.send({
      forms: forms.map((form) => ({
        id: form.id,
        programId: form.programId,
        programFormId: form.programFormId,
        name: form.name,
        version: form.version,
        createdAt: form.createdAt?.getTime?.() ?? null,
        updatedAt: form.updatedAt?.getTime?.() ?? null,
      })),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to list form versions' });
  }
}
