import { Op } from 'sequelize';
import { getSessionList } from './getList';
import { Session, Site } from '../../db/models';
import { assignedSitesAccess, unrestrictedAccess } from '../../test/access';

jest.mock('../../db/models', () => ({
  CollectionCycle: {},
  User: {},
  Session: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  Site: {
    findAll: jest.fn(),
  },
}));

jest.mock('../site/common', () => ({
  parseSiteIds: jest.fn((value?: string) =>
    value
      ? value.split(',').map((entry) => Number(entry.trim())).filter((id) => Number.isInteger(id) && id > 0)
      : []
  ),
  siteIdsInSubtreesOfLiteral: jest.fn(() => ({ __literal: true })),
}));

jest.mock('./common', () => ({
  formatSessionResponse: jest.fn((session) => session),
  certifierInclude: {
    as: 'certifier',
    model: {},
    attributes: ['id', 'name'],
    required: false,
  },
  certifiedByResponseSchema: {},
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
  };
}

describe('getSessionList hierarchy filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Session.count as jest.Mock).mockResolvedValue(0);
    (Session.findAll as jest.Mock).mockResolvedValue([]);
    (Site.findAll as jest.Mock).mockResolvedValue([]);
  });

  it('restricts sessions to accessible site ids', async () => {
    const request: any = {
      query: {},
      access: assignedSitesAccess([10, 11]),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSessionList(request, reply as any);

    const countWhere = (Session.count as jest.Mock).mock.calls[0][0].where;
    expect(countWhere.siteId[Op.in]).toEqual([10, 11]);
  });

  it('uses hasData in db query when filtering sites by program/district', async () => {
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 6 }]);

    const request: any = {
      query: { programId: 2, district: 'Arua' },
      access: assignedSitesAccess([5, 6]),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSessionList(request, reply as any);

    expect(Site.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programId: 2,
          district: 'Arua',
          hasData: true,
        }),
      })
    );
  });

  it('filters sessions by collection cycle id', async () => {
    const request: any = {
      query: { collectionCycleId: 123 },
      access: unrestrictedAccess(),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSessionList(request, reply as any);

    const countArgs = (Session.count as jest.Mock).mock.calls[0][0];
    const findArgs = (Session.findAll as jest.Mock).mock.calls[0][0];
    expect(countArgs.where.collectionCycleId).toBe(123);
    expect(findArgs.where.collectionCycleId).toBe(123);
    expect(countArgs.include).toEqual([]);
    expect(findArgs.include).toEqual(expect.arrayContaining([
      expect.objectContaining({ as: 'certifier' }),
    ]));
  });

  it('filters unassigned sessions when collectionCycleId is null', async () => {
    const request: any = {
      query: { collectionCycleId: 'null' },
      access: unrestrictedAccess(),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSessionList(request, reply as any);

    const countWhere = (Session.count as jest.Mock).mock.calls[0][0].where;
    const findWhere = (Session.findAll as jest.Mock).mock.calls[0][0].where;
    expect(countWhere.collectionCycleId).toBeNull();
    expect(findWhere.collectionCycleId).toBeNull();
  });

  it('filters sessions by assigned collection cycle date range', async () => {
    const request: any = {
      query: {
        cycleStartDate: '2026-04-01',
        cycleEndDate: '2026-04-30',
      },
      access: unrestrictedAccess(),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSessionList(request, reply as any);

    const countInclude = (Session.count as jest.Mock).mock.calls[0][0].include;
    const findInclude = (Session.findAll as jest.Mock).mock.calls[0][0].include;
    expect(countInclude).toHaveLength(1);
    expect(findInclude).toEqual(expect.arrayContaining(countInclude));
    expect(findInclude).toEqual(expect.arrayContaining([
      expect.objectContaining({ as: 'certifier' }),
    ]));
    expect(countInclude[0]).toEqual(expect.objectContaining({
      as: 'collectionCycle',
      required: true,
      where: {
        startDate: { [Op.gte]: new Date('2026-04-01') },
        endDate: { [Op.lte]: new Date('2026-04-30T23:59:59.999Z') },
      },
    }));
  });

  it('filters sessions by requested siteIds subtree', async () => {
    const request: any = {
      query: { siteIds: '10,20' },
      access: unrestrictedAccess(),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSessionList(request, reply as any);

    const countWhere = (Session.count as jest.Mock).mock.calls[0][0].where;
    expect(countWhere.siteId[Op.in]).toEqual({ __literal: true });
    expect(Session.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ as: 'certifier' }),
        ]),
      })
    );
  });
});
