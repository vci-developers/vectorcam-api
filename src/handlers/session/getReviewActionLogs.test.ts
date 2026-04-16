import { Op } from 'sequelize';
import { getReviewActionLogs } from './getReviewActionLogs';
import { ReviewActionLog } from '../../db/models';
import { expandSiteIdsWithDescendants } from '../site/common';

jest.mock('../../db/models', () => ({
  ReviewActionLog: {
    count: jest.fn(),
    findAll: jest.fn(),
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

describe('getReviewActionLogs hierarchy filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ReviewActionLog.count as jest.Mock).mockResolvedValue(0);
    (ReviewActionLog.findAll as jest.Mock).mockResolvedValue([]);
  });

  it('uses expanded accessible ids and Op.in for requested site', async () => {
    (expandSiteIdsWithDescendants as jest.Mock)
      .mockResolvedValueOnce([1, 2]) // expanded accessible ids
      .mockResolvedValueOnce([2, 3]); // expanded requested siteId

    const request: any = {
      query: { siteId: 2 },
      siteAccess: { userSites: [1] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getReviewActionLogs(request, reply as any);

    const where = (ReviewActionLog.count as jest.Mock).mock.calls[0][0].where;
    expect(where.siteId[Op.in]).toEqual([2]);
  });
});
