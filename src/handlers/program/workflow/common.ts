import { Op } from 'sequelize';
import { Form } from '../../../db/models';
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

export function collectProgramFormIds(schema: Record<string, unknown>): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }

    const record = value as Record<string, unknown>;
    const programFormId = record.programFormId;
    if (typeof programFormId === 'number' && Number.isInteger(programFormId) && programFormId > 0) {
      if (!seen.has(programFormId)) {
        seen.add(programFormId);
        ids.push(programFormId);
      }
    }

    for (const [key, nested] of Object.entries(record)) {
      if (key === 'editorState' || key === 'programFormId') {
        continue;
      }
      visit(nested);
    }
  };

  visit(schema);
  return ids;
}

export async function unpublishedProgramFormError(
  programId: number,
  schema: Record<string, unknown>
): Promise<string | null> {
  const invalid = findInvalidProgramFormId(schema);
  if (invalid) {
    return invalid;
  }

  const programFormIds = collectProgramFormIds(schema);
  if (programFormIds.length === 0) {
    return null;
  }

  const published = await Form.findAll({
    attributes: ['programFormId'],
    where: {
      programId,
      programFormId: { [Op.in]: programFormIds },
      version: { [Op.ne]: '' },
    },
  });
  const publishedIds = new Set(published.map((form) => form.programFormId));
  const missing = programFormIds.filter((id) => !publishedIds.has(id));
  if (missing.length === 0) {
    return null;
  }

  const label = missing.length === 1 ? 'Program form' : 'Program forms';
  const verb = missing.length === 1 ? 'has' : 'have';
  return `${label} ${missing.join(', ')} ${verb} no published version`;
}

function findInvalidProgramFormId(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const error = findInvalidProgramFormId(item);
      if (error) {
        return error;
      }
    }
    return null;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if ('programFormId' in record) {
    const programFormId = record.programFormId;
    if (typeof programFormId !== 'number' || !Number.isInteger(programFormId) || programFormId <= 0) {
      return 'programFormId must be a positive integer';
    }
  }

  for (const [key, nested] of Object.entries(record)) {
    if (key === 'editorState' || key === 'programFormId') {
      continue;
    }
    const error = findInvalidProgramFormId(nested);
    if (error) {
      return error;
    }
  }
  return null;
}

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
