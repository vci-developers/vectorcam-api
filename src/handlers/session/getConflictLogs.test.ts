import { Op } from 'sequelize';
import { getConflictLogs } from './getConflictLogs';
import { SessionConflictResolution } from '../../db/models';
import { expandSiteIdsWithDescendants } from '../site/common';

jest.mock('../../db/models', () => ({
  SessionConflictResolution: {
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

describe('getConflictLogs hierarchy filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SessionConflictResolution.count as jest.Mock).mockResolvedValue(0);
    (SessionConflictResolution.findAll as jest.Mock).mockResolvedValue([]);
  });

  it('uses expanded accessible ids and Op.in for requested site', async () => {
    (expandSiteIdsWithDescendants as jest.Mock)
      .mockResolvedValueOnce([1, 2]) // expanded accessible ids
      .mockResolvedValueOnce([2, 3]); // expanded requested siteId

    const request: any = {
      query: { siteId: '2' },
      siteAccess: { userSites: [1] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getConflictLogs(request, reply as any);

    const where = (SessionConflictResolution.count as jest.Mock).mock.calls[0][0].where;
    expect(where.siteId[Op.in]).toEqual([2]);
  });
});
