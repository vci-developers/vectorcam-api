import { FastifyReply, FastifyRequest } from 'fastify';
import { UniqueConstraintError } from 'sequelize';
import { Workflow } from '../../../db/models';
import { findProgramById } from '../common';
import { serializeWorkflow, unpublishedProgramFormError, workflowResponseSchema } from './common';

interface CreateWorkflowBody {
  name: string;
  schema: Record<string, unknown>;
  isActive?: boolean;
}

export const schema = {
  tags: ['Programs'],
  description: 'Create the workflow for a program',
  params: {
    type: 'object',
    required: ['program_id'],
    properties: {
      program_id: { type: 'number' },
    },
  },
  body: {
    type: 'object',
    required: ['name', 'schema'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      schema: { type: 'object', additionalProperties: true },
      isActive: { type: 'boolean' },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        workflow: workflowResponseSchema,
      },
    },
  },
};

export async function createProgramWorkflow(
  request: FastifyRequest<{ Params: { program_id: number }; Body: CreateWorkflowBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const programId = request.params.program_id;
    const program = await findProgramById(programId);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const name = request.body.name.trim();
    if (!name) {
      return reply.code(400).send({ error: 'name is required' });
    }

    const publishedError = await unpublishedProgramFormError(programId, request.body.schema);
    if (publishedError) {
      return reply.code(400).send({ error: publishedError });
    }

    const workflow = await Workflow.create({
      programId,
      name,
      schema: request.body.schema,
      isActive: request.body.isActive ?? false,
    });

    return reply.code(201).send({
      message: 'Workflow created',
      workflow: serializeWorkflow(workflow),
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return reply.code(409).send({ error: 'A workflow already exists for this program' });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to create workflow' });
  }
}
