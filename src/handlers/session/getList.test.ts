import { Op } from 'sequelize';
import { getSessionList } from './getList';
import { Session, Site } from '../../db/models';
import { expandSiteIdsWithDescendants } from '../site/common';

jest.mock('../../db/models', () => ({
  Session: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  Site: {
    findAll: jest.fn(),
  },
}));

jest.mock('../site/common', () => ({
  expandSiteIdsWithDescendants: jest.fn(),
}));

jest.mock('./common', () => ({
  formatSessionResponse: jest.fn((session) => session),
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

  it('expands accessible site ids at endpoint level', async () => {
    (expandSiteIdsWithDescendants as jest.Mock).mockResolvedValue([10, 11]);

    const request: any = {
      query: {},
      siteAccess: { userSites: [10] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSessionList(request, reply as any);

    expect(expandSiteIdsWithDescendants).toHaveBeenCalledWith([10], { includeHasDataOnly: false });
    const countWhere = (Session.count as jest.Mock).mock.calls[0][0].where;
    expect(countWhere.siteId[Op.in]).toEqual([10, 11]);
  });

  it('uses hasData in db query when filtering sites by program/district', async () => {
    (expandSiteIdsWithDescendants as jest.Mock).mockResolvedValue([5, 6]);
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 6 }]);

    const request: any = {
      query: { programId: 2, district: 'Arua' },
      siteAccess: { userSites: [5] },
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
});
