import { Op } from 'sequelize';
import { getReviewActionLogs } from './getReviewActionLogs';
import { ReviewActionLog, Site, User } from '../../db/models';
import { assignedSitesAccess, unrestrictedAccess } from '../../test/access';

jest.mock('../../db/models', () => ({
  ReviewActionLog: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  Site: {
    count: jest.fn(),
  },
  User: {
    findAll: jest.fn(),
  },
}));

jest.mock('../site/common', () => ({
  buildSiteSubtreeWhere: jest.fn(() => ({ __subtree: true })),
  siteIdInSubtreeOfLiteral: jest.fn(() => ({ __literal: true })),
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
  };
}

describe('getReviewActionLogs hierarchy filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ReviewActionLog.count as jest.Mock).mockResolvedValue(0);
    (ReviewActionLog.findAll as jest.Mock).mockResolvedValue([]);
    (User.findAll as jest.Mock).mockResolvedValue([]);
    (Site.count as jest.Mock).mockResolvedValue(1);
  });

  it('restricts to accessible site ids and pushes the requested subtree to SQL', async () => {
    const request: any = {
      query: { siteId: 2 },
      access: assignedSitesAccess([1, 2]),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getReviewActionLogs(request, reply as any);

    const where = (ReviewActionLog.count as jest.Mock).mock.calls[0][0].where;
    expect(where[Op.and]).toEqual([
      { siteId: { [Op.in]: [1, 2] } },
      { siteId: { [Op.in]: { __literal: true } } },
    ]);
  });

  it('returns 403 when the requested subtree does not overlap with accessible sites', async () => {
    (Site.count as jest.Mock).mockResolvedValueOnce(0);

    const request: any = {
      query: { siteId: 99 },
      access: assignedSitesAccess([1]),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getReviewActionLogs(request, reply as any);

    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it('filters logs by collectionCycleId', async () => {
    const request: any = {
      query: { collectionCycleId: 12 },
      access: unrestrictedAccess(),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getReviewActionLogs(request, reply as any);

    const where = (ReviewActionLog.count as jest.Mock).mock.calls[0][0].where;
    expect(where.collectionCycleId).toBe(12);
  });

  it('filters logs by specimenId', async () => {
    const request: any = {
      query: { specimenId: 55 },
      access: unrestrictedAccess(),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getReviewActionLogs(request, reply as any);

    const where = (ReviewActionLog.count as jest.Mock).mock.calls[0][0].where;
    expect(where.specimenId).toBe(55);
  });
});
