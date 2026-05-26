import { SessionUnit } from '../../../db/models';

export interface SessionUnitResponse {
  id: number;
  sessionId: number;
  frontendId: string | null;
  unitOrder: number;
  createdAt: number | null;
  updatedAt: number | null;
}

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
