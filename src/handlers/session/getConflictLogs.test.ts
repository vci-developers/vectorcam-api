import { Op } from 'sequelize';
import { getConflictLogs } from './getConflictLogs';
import { SessionConflictResolution, Site } from '../../db/models';
import { assignedSitesAccess } from '../../test/access';

jest.mock('../../db/models', () => ({
  SessionConflictResolution: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  Site: {
    count: jest.fn(),
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

describe('getConflictLogs hierarchy filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SessionConflictResolution.count as jest.Mock).mockResolvedValue(0);
    (SessionConflictResolution.findAll as jest.Mock).mockResolvedValue([]);
    (Site.count as jest.Mock).mockResolvedValue(1);
  });

  it('restricts to accessible site ids and pushes the requested subtree to SQL', async () => {
    const request: any = {
      query: { siteId: '2' },
      access: assignedSitesAccess([1, 2]),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getConflictLogs(request, reply as any);

    const where = (SessionConflictResolution.count as jest.Mock).mock.calls[0][0].where;
    expect(where[Op.and]).toEqual([
      { siteId: { [Op.in]: [1, 2] } },
      { siteId: { [Op.in]: { __literal: true } } },
    ]);
  });

  it('returns 403 when the requested subtree does not overlap with accessible sites', async () => {
    (Site.count as jest.Mock).mockResolvedValueOnce(0);

    const request: any = {
      query: { siteId: '99' },
      access: assignedSitesAccess([1]),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getConflictLogs(request, reply as any);

    expect(reply.code).toHaveBeenCalledWith(403);
  });
});
