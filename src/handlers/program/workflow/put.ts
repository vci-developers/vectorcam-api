import { FastifyReply, FastifyRequest } from 'fastify';
import { Workflow } from '../../../db/models';
import { serializeWorkflow, workflowResponseSchema } from './common';

interface UpdateWorkflowBody {
  name?: string;
  schema?: Record<string, unknown>;
  isActive?: boolean;
}

export const schema = {
  tags: ['Programs'],
  description: 'Update the workflow for a program',
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      schema: { type: 'object', additionalProperties: true },
      isActive: { type: 'boolean' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        workflow: workflowResponseSchema,
      },
    },
  },
};

export async function updateProgramWorkflow(
  request: FastifyRequest<{ Params: { program_id: number }; Body: UpdateWorkflowBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const workflow = await Workflow.findOne({ where: { programId: request.params.program_id } });
    if (!workflow) {
      return reply.code(404).send({ error: 'Workflow not found' });
    }

    const updates: { name?: string; schema?: Record<string, unknown>; isActive?: boolean } = {};
    if (request.body.name !== undefined) {
      const name = request.body.name.trim();
      if (!name) {
        return reply.code(400).send({ error: 'name is required' });
      }
      updates.name = name;
    }
    if (request.body.schema !== undefined) {
      updates.schema = request.body.schema;
    }
    if (request.body.isActive !== undefined) {
      updates.isActive = request.body.isActive;
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No updates provided' });
    }

    await workflow.update(updates);
    return reply.send({
      message: 'Workflow updated',
      workflow: serializeWorkflow(workflow),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to update workflow' });
  }
}
