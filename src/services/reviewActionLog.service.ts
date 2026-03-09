import { ReviewActionLog } from '../db/models';

interface ReviewActionLogInput {
  siteId: number;
  year: number;
  month: number;
  action: string;
  userId?: number | null;
  changes?: Record<string, unknown> | null;
  fields?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

type DiffValue = {
  before: unknown;
  after: unknown;
};

function toComparable(value: unknown): unknown {
  if (value instanceof Date) {
    return value.getTime();
  }
  return value;
}

export function getChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fieldsToCompare?: string[]
): Record<string, DiffValue> {
  const fields = fieldsToCompare || Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changes: Record<string, DiffValue> = {};

  for (const field of fields) {
    const beforeValue = toComparable(before[field]);
    const afterValue = toComparable(after[field]);
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes[field] = {
        before: beforeValue,
        after: afterValue,
      };
    }
  }

  return changes;
}

export async function logReviewAction(input: ReviewActionLogInput): Promise<void> {
  await ReviewActionLog.create({
    ...input,
    userId: input.userId ?? null,
    hasChanges: Boolean(input.changes && Object.keys(input.changes).length > 0),
    changes: input.changes || null,
    fields: input.fields || null,
    metadata: input.metadata || null,
  });
}
