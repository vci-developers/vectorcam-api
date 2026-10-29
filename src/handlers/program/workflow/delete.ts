import { FastifyReply, FastifyRequest } from 'fastify';
import { Workflow } from '../../../db/models';

export const schema = {
  tags: ['Programs'],
  description: 'Delete the workflow for a program',
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  },
};

export async function deleteProgramWorkflow(
  request: FastifyRequest<{ Params: { program_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const workflow = await Workflow.findOne({ where: { programId: request.params.program_id } });
    if (!workflow) {
      return reply.code(404).send({ error: 'Workflow not found' });
    }

    await workflow.destroy();
    return reply.send({ message: 'Workflow deleted' });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to delete workflow' });
  }
}
