import { Op } from 'sequelize';
import { getReviewActionLogs } from './getReviewActionLogs';
import { ReviewActionLog, Site } from '../../db/models';
import { expandSiteIdsWithDescendants } from '../site/common';

jest.mock('../../db/models', () => ({
  ReviewActionLog: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  Site: {
    count: jest.fn(),
  },
}));

jest.mock('../site/common', () => ({
  expandSiteIdsWithDescendants: jest.fn(),
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
    (Site.count as jest.Mock).mockResolvedValue(1);
  });

  it('only expands accessible site ids and pushes the requested subtree to SQL', async () => {
    (expandSiteIdsWithDescendants as jest.Mock).mockResolvedValueOnce([1, 2]);

    const request: any = {
      query: { siteId: 2 },
      siteAccess: { userSites: [1] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getReviewActionLogs(request, reply as any);

    expect(expandSiteIdsWithDescendants).toHaveBeenCalledTimes(1);
    expect(expandSiteIdsWithDescendants).toHaveBeenCalledWith([1]);

    const where = (ReviewActionLog.count as jest.Mock).mock.calls[0][0].where;
    expect(where[Op.and]).toEqual([
      { siteId: { [Op.in]: [1, 2] } },
      { siteId: { [Op.in]: { __literal: true } } },
    ]);
  });

  it('returns 403 when the requested subtree does not overlap with accessible sites', async () => {
    (expandSiteIdsWithDescendants as jest.Mock).mockResolvedValueOnce([1]);
    (Site.count as jest.Mock).mockResolvedValueOnce(0);

    const request: any = {
      query: { siteId: 99 },
      siteAccess: { userSites: [1] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getReviewActionLogs(request, reply as any);

    expect(reply.code).toHaveBeenCalledWith(403);
  });
});
