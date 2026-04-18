import { Op } from 'sequelize';
import { getSpecimenMonthlySummary } from './getMonthlySummary';
import { Site } from '../../db/models';
import sequelize from '../../db/index';
import { expandSiteIdsWithDescendants } from '../site/common';

jest.mock('../../db/models', () => ({
  Site: {
    findAll: jest.fn(),
  },
}));

jest.mock('../../db/index', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock('../site/common', () => ({
  expandSiteIdsWithDescendants: jest.fn(),
  buildSiteSubtreeWhere: jest.fn(() => ({ __subtree: true })),
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
  };
}

describe('getSpecimenMonthlySummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns month buckets with from/to timestamps and grouped counts', async () => {
    (expandSiteIdsWithDescendants as jest.Mock).mockResolvedValueOnce([]); // accessible user sites
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 2 }, { id: 3 }]);
    (sequelize.query as jest.Mock).mockResolvedValue([
      { monthStart: '2026-01-01', species: 'Anopheles gambiae', sex: 'Female', abdomenStatus: 'Fully Fed', count: 5 },
      { monthStart: '2026-03-01', species: 'Culex', sex: 'Male', abdomenStatus: 'Unfed', count: 2 },
    ]);

    const request: any = {
      query: {
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        districts: 'Adjumani',
        siteIds: '1',
      },
      siteAccess: { canRead: true, userSites: [] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenMonthlySummary(request, reply as any);

    // requested siteIds should no longer be pre-expanded via expandSiteIdsWithDescendants
    expect(expandSiteIdsWithDescendants).toHaveBeenCalledTimes(1);
    expect(expandSiteIdsWithDescendants).toHaveBeenCalledWith([]);

    const whereArg = (Site.findAll as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.hasData).toBe(true);
    expect(whereArg.district[Op.in]).toEqual(['Adjumani']);
    expect(whereArg[Op.and]).toEqual([{ __subtree: true }]);

    const payload = (reply.send as jest.Mock).mock.calls[0][0];
    expect(payload.interval).toBe('MONTH');
    expect(payload.data).toHaveLength(3); // Jan/Feb/Mar
    expect(payload.data[0]).toEqual(expect.objectContaining({
      from: '2026-01-01',
      to: '2026-01-31',
      totalSpecimens: 5,
      species: { 'Anopheles gambiae': 5 },
    }));
    expect(payload.data[1]).toEqual(expect.objectContaining({
      from: '2026-02-01',
      to: '2026-02-28',
      totalSpecimens: 0,
    }));
  });

  it('excludes non-mosquitoes from sex counts and males from abdomen status counts', async () => {
    (expandSiteIdsWithDescendants as jest.Mock).mockResolvedValueOnce([]);
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 1 }]);
    (sequelize.query as jest.Mock).mockResolvedValue([
      // Non-mosquito: species counted, sex/abdomen N/A and excluded
      { monthStart: '2026-01-01', species: 'Non-Mosquito', sex: null, abdomenStatus: null, count: 4 },
      // Male mosquito: species + sex counted, abdomen N/A and excluded
      { monthStart: '2026-01-01', species: 'Culex', sex: 'Male', abdomenStatus: null, count: 3 },
      // Female mosquito: all three counted
      { monthStart: '2026-01-01', species: 'Anopheles gambiae', sex: 'Female', abdomenStatus: 'Unfed', count: 2 },
      // Mosquito with missing predictions: counted as UNKNOWN across the board
      { monthStart: '2026-01-01', species: null, sex: null, abdomenStatus: null, count: 1 },
    ]);

    const request: any = {
      query: { startDate: '2026-01-01', endDate: '2026-01-31' },
      siteAccess: { canRead: true, userSites: [] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenMonthlySummary(request, reply as any);

    const payload = (reply.send as jest.Mock).mock.calls[0][0];
    expect(payload.data).toHaveLength(1);
    const bucket = payload.data[0];

    expect(bucket.totalSpecimens).toBe(10);
    expect(bucket.species).toEqual({
      'Non-Mosquito': 4,
      Culex: 3,
      'Anopheles gambiae': 2,
      UNKNOWN: 1,
    });
    expect(bucket.sex).toEqual({
      Male: 3,
      Female: 2,
      UNKNOWN: 1,
    });
    expect(bucket.abdomenStatus).toEqual({
      Unfed: 2,
      UNKNOWN: 1,
    });
  });

  it('filters by accessibleSiteIds and the requested subtree via JSON siteIds', async () => {
    (expandSiteIdsWithDescendants as jest.Mock).mockResolvedValueOnce([10, 11]); // accessible user sites expansion
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 11 }]);
    (sequelize.query as jest.Mock).mockResolvedValue([]);

    const request: any = {
      query: { siteIds: '11' },
      siteAccess: { canRead: true, userSites: [10] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenMonthlySummary(request, reply as any);

    expect(expandSiteIdsWithDescendants).toHaveBeenCalledTimes(1);
    expect(expandSiteIdsWithDescendants).toHaveBeenCalledWith([10]);

    const whereArg = (Site.findAll as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.id[Op.in]).toEqual([10, 11]);
    expect(whereArg[Op.and]).toEqual([{ __subtree: true }]);
  });
});
