import Workflow from '../../../db/models/Workflow';

export const workflowResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    programId: { type: 'number' },
    name: { type: 'string' },
    schema: { type: 'object', additionalProperties: true },
    isActive: { type: 'boolean' },
    createdAt: { type: ['number', 'null'] },
    updatedAt: { type: ['number', 'null'] },
  },
};

export function serializeWorkflow(workflow: Workflow): Record<string, unknown> {
  return {
    id: workflow.id,
    programId: workflow.programId,
    name: workflow.name,
    schema: workflow.schema,
    isActive: workflow.isActive,
    createdAt: workflow.createdAt?.getTime?.() ?? null,
    updatedAt: workflow.updatedAt?.getTime?.() ?? null,
  };
}
