import { FastifyReply, FastifyRequest } from 'fastify';
import { Workflow } from '../../../db/models';
import { serializeWorkflow, workflowResponseSchema } from './common';

export const schema = {
  tags: ['Programs'],
  description: 'Get the workflow for a program',
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  response: {
    200: workflowResponseSchema,
  },
};

export async function getProgramWorkflow(
  request: FastifyRequest<{ Params: { program_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const workflow = await Workflow.findOne({ where: { programId: request.params.program_id } });
    if (!workflow) {
      return reply.code(404).send({ error: 'Workflow not found' });
    }

    return reply.send(serializeWorkflow(workflow));
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to get workflow' });
  }
}
