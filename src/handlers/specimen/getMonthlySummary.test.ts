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
    (expandSiteIdsWithDescendants as jest.Mock)
      .mockResolvedValueOnce([]) // accessible user sites
      .mockResolvedValueOnce([1, 2, 3]); // requested siteIds expansion
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

    expect(expandSiteIdsWithDescendants).toHaveBeenCalledWith([1], { includeHasDataOnly: false });

    const whereArg = (Site.findAll as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.hasData).toBe(true);
    expect(whereArg.district[Op.in]).toEqual(['Adjumani']);
    expect(whereArg.id[Op.in]).toEqual([1, 2, 3]);

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

  it('intersects requested sites with expanded accessible sites', async () => {
    (expandSiteIdsWithDescendants as jest.Mock)
      .mockResolvedValueOnce([10, 11]) // accessible user sites expansion
      .mockResolvedValueOnce([11, 12]); // requested siteIds expansion
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 11 }]);
    (sequelize.query as jest.Mock).mockResolvedValue([]);

    const request: any = {
      query: { siteIds: '11' },
      siteAccess: { canRead: true, userSites: [10] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenMonthlySummary(request, reply as any);

    const whereArg = (Site.findAll as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.id[Op.in]).toEqual([11]);
  });
});
