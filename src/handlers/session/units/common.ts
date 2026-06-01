import { SessionUnit } from '../../../db/models';

export interface SessionUnitResponse {
  id: number;
  sessionId: number;
  frontendId: string | null;
  unitOrder: number;
  createdAt: number | null;
  updatedAt: number | null;
}

export const sessionUnitResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    sessionId: { type: 'number' },
    frontendId: { type: ['string', 'null'] },
    unitOrder: { type: 'number' },
    createdAt: { type: ['number', 'null'] },
    updatedAt: { type: ['number', 'null'] },
  },
};

export function formatSessionUnit(unit: SessionUnit): SessionUnitResponse {
  return {
    id: unit.id,
    sessionId: unit.sessionId,
    frontendId: unit.frontendId ?? null,
    unitOrder: unit.unitOrder,
    createdAt: unit.createdAt?.getTime?.() ?? null,
    updatedAt: unit.updatedAt?.getTime?.() ?? null,
  };
}
