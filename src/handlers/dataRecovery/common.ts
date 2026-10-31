export interface DataRecoveryRecord {
  id: number;
  idempotencyKey: string;
  programId: number | null;
  siteId: number | null;
  sessionFrontendId: string | null;
  year: number | null;
  month: number | null;
  status: string;
  notes: string | null;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export const dataRecoverySummarySchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    idempotencyKey: { type: 'string' },
    programId: { type: ['number', 'null'] },
    siteId: { type: ['number', 'null'] },
    sessionFrontendId: { type: ['string', 'null'] },
    year: { type: ['number', 'null'] },
    month: { type: ['number', 'null'] },
    status: { type: 'string' },
    notes: { type: ['string', 'null'] },
    createdAt: { type: ['number', 'null'] },
    updatedAt: { type: ['number', 'null'] },
  },
};

export const dataRecoverySchema = {
  type: 'object',
  properties: {
    ...dataRecoverySummarySchema.properties,
    payload: {},
  },
};

export function serializeDataRecoverySummary(record: DataRecoveryRecord): Record<string, unknown> {
  return {
    id: record.id,
    idempotencyKey: record.idempotencyKey,
    programId: record.programId ?? null,
    siteId: record.siteId ?? null,
    sessionFrontendId: record.sessionFrontendId ?? null,
    year: record.year ?? null,
    month: record.month ?? null,
    status: record.status,
    notes: record.notes ?? null,
    createdAt: record.createdAt?.getTime?.() ?? null,
    updatedAt: record.updatedAt?.getTime?.() ?? null,
  };
}

export function serializeDataRecovery(record: DataRecoveryRecord): Record<string, unknown> {
  return {
    ...serializeDataRecoverySummary(record),
    payload: record.payload,
  };
}

export function parseOptionalInt(
  value: unknown,
  label: string,
  bounds?: { min: number; max: number }
): { value?: number; error?: string } {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { error: `${label} must be an integer` };
  }
  if (bounds && (value < bounds.min || value > bounds.max)) {
    return { error: `${label} must be between ${bounds.min} and ${bounds.max}` };
  }
  return { value };
}
