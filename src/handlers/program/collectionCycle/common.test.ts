jest.mock('../../../db', () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (callback: any) => callback({ LOCK: { UPDATE: 'UPDATE' } })),
  },
}));

jest.mock('../../../db/models/CollectionSchedule', () => ({
  CollectionScheduleCadenceType: {
    RECURRING: 'RECURRING',
    MANUAL: 'MANUAL',
  },
  CollectionScheduleIntervalUnit: {
    DAY: 'DAY',
    WEEK: 'WEEK',
    MONTH: 'MONTH',
    YEAR: 'YEAR',
  },
}));

jest.mock('../../../db/models', () => ({
  CollectionCycle: {
    findOrCreate: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    max: jest.fn(),
    create: jest.fn(),
  },
  CollectionSchedule: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  Program: {
    findByPk: jest.fn(),
  },
  Session: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Site: {
    findByPk: jest.fn(),
  },
}));

import {
  assignCollectionCycleOnSessionUpload,
  findOrCreateGeneratedCollectionCycle,
  getCycleBoundsForDate,
  reassignSessionCollectionCycle,
} from './common';
import { CollectionCycle, CollectionSchedule, Session, Site } from '../../../db/models';
import {
  CollectionScheduleCadenceType,
  CollectionScheduleIntervalUnit,
} from '../../../db/models/CollectionSchedule';

describe('collection cycle handler common logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates earlier empty recurring cycles before returning the target cycle', async () => {
    const schedule = {
      id: 10,
      programId: 2,
      cadenceType: CollectionScheduleCadenceType.RECURRING,
      intervalUnit: CollectionScheduleIntervalUnit.MONTH,
      intervalCount: 1,
      effectiveStartDate: new Date('2026-01-01T00:00:00.000Z'),
      effectiveEndDate: null,
    } as any;
    const targetCycle = { id: 44, collectionScheduleId: 10, cycleNumber: 4 };

    (CollectionCycle.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);
    (CollectionCycle.findOne as jest.Mock).mockResolvedValue(targetCycle);

    const result = await findOrCreateGeneratedCollectionCycle(
      schedule,
      new Date('2026-04-15T00:00:00.000Z')
    );

    expect(result).toBe(targetCycle);
    expect(CollectionCycle.findOrCreate).toHaveBeenCalledTimes(4);
    expect((CollectionCycle.findOrCreate as jest.Mock).mock.calls.map(([arg]) => arg.defaults.cycleNumber))
      .toEqual([1, 2, 3, 4]);
    expect((CollectionCycle.findOrCreate as jest.Mock).mock.calls[0][0].defaults.startDate)
      .toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect((CollectionCycle.findOrCreate as jest.Mock).mock.calls[3][0].defaults.startDate)
      .toEqual(new Date('2026-04-01T00:00:00.000Z'));
  });

  it('leaves uploaded sessions unassigned for manual schedules without a matching manual cycle', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const session = {
      id: 99,
      siteId: 5,
      collectionDate: new Date('2026-04-15T00:00:00.000Z'),
      get: jest.fn((key: string) => key === 'site' ? { id: 5, programId: 2 } : undefined),
      update,
    };
    const schedule = {
      id: 10,
      programId: 2,
      cadenceType: CollectionScheduleCadenceType.MANUAL,
    };

    (Session.findByPk as jest.Mock).mockResolvedValue(session);
    (CollectionSchedule.findOne as jest.Mock).mockResolvedValue(schedule);
    (CollectionCycle.findOne as jest.Mock).mockResolvedValue(null);

    const result = await assignCollectionCycleOnSessionUpload(99);

    expect(result).toBeNull();
    expect(CollectionCycle.findOrCreate).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ collectionCycleId: null }, { transaction: undefined });
  });

  it('rejects reassignment to a collection cycle from another program', async () => {
    const update = jest.fn();
    const session = {
      id: 99,
      frontendId: 'frontend-session',
      siteId: 5,
      update,
    };

    (Session.findByPk as jest.Mock).mockResolvedValue(session);
    (CollectionCycle.findByPk as jest.Mock).mockResolvedValue({ id: 88, programId: 3 });
    (Site.findByPk as jest.Mock).mockResolvedValue({ id: 5, programId: 2 });

    await expect(reassignSessionCollectionCycle('99', 88))
      .rejects
      .toThrow('Collection cycle does not belong to the session program');
    expect(update).not.toHaveBeenCalled();
  });

  it('uses schedule timezone when calculating monthly cycle bounds', () => {
    const schedule = {
      id: 10,
      programId: 2,
      cadenceType: CollectionScheduleCadenceType.RECURRING,
      intervalUnit: CollectionScheduleIntervalUnit.MONTH,
      intervalCount: 1,
      effectiveStartDate: new Date('2026-01-31T05:00:00.000Z'),
      effectiveEndDate: null,
      timezone: 'America/New_York',
    } as any;

    const firstCycle = getCycleBoundsForDate(schedule, new Date('2026-02-10T12:00:00.000Z'));
    expect(firstCycle.cycleNumber).toBe(1);
    expect(firstCycle.startDate).toEqual(new Date('2026-01-31T05:00:00.000Z'));
    expect(firstCycle.endDate).toEqual(new Date('2026-02-28T05:00:00.000Z'));

    const secondCycle = getCycleBoundsForDate(schedule, new Date('2026-03-10T12:00:00.000Z'));
    expect(secondCycle.cycleNumber).toBe(2);
    expect(secondCycle.startDate).toEqual(new Date('2026-02-28T05:00:00.000Z'));
    expect(secondCycle.endDate).toEqual(new Date('2026-03-28T04:00:00.000Z'));
  });

  it('uses schedule timezone when calculating yearly cycle bounds', () => {
    const schedule = {
      id: 11,
      programId: 2,
      cadenceType: CollectionScheduleCadenceType.RECURRING,
      intervalUnit: CollectionScheduleIntervalUnit.YEAR,
      intervalCount: 1,
      effectiveStartDate: new Date('2024-02-29T05:00:00.000Z'),
      effectiveEndDate: null,
      timezone: 'America/New_York',
    } as any;

    const bounds = getCycleBoundsForDate(schedule, new Date('2025-03-01T12:00:00.000Z'));
    expect(bounds.cycleNumber).toBe(2);
    expect(bounds.startDate).toEqual(new Date('2025-02-28T05:00:00.000Z'));
    expect(bounds.endDate).toEqual(new Date('2026-02-28T05:00:00.000Z'));
  });

  it('falls back to UTC month arithmetic when schedule timezone is missing', () => {
    const schedule = {
      id: 12,
      programId: 2,
      cadenceType: CollectionScheduleCadenceType.RECURRING,
      intervalUnit: CollectionScheduleIntervalUnit.MONTH,
      intervalCount: 1,
      effectiveStartDate: new Date('2026-01-01T00:00:00.000Z'),
      effectiveEndDate: null,
      timezone: null,
    } as any;

    const bounds = getCycleBoundsForDate(schedule, new Date('2026-04-15T00:00:00.000Z'));
    expect(bounds.cycleNumber).toBe(4);
    expect(bounds.startDate).toEqual(new Date('2026-04-01T00:00:00.000Z'));
    expect(bounds.endDate).toEqual(new Date('2026-05-01T00:00:00.000Z'));
  });
});
