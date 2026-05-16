import { Op } from 'sequelize';
import { getUnassignedProgramSessions } from './getUnassigned';
import { Session, Site } from '../../../db/models';
import { expandSiteIdsWithDescendants } from '../../site/common';

jest.mock('../../../db/models', () => ({
  Session: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  Site: {
    findAll: jest.fn(),
  },
}));

jest.mock('../../site/common', () => ({
  expandSiteIdsWithDescendants: jest.fn(),
}));

jest.mock('../../session/common', () => ({
  formatSessionResponse: jest.fn((session) => session),
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
  };
}

describe('getUnassignedProgramSessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Session.count as jest.Mock).mockResolvedValue(0);
    (Session.findAll as jest.Mock).mockResolvedValue([]);
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 11 }]);
  });

  it('restricts program sites to accessible site ids', async () => {
    (expandSiteIdsWithDescendants as jest.Mock).mockResolvedValue([10, 11]);

    const request: any = {
      params: { program_id: 2 },
      query: {},
      siteAccess: { userSites: [10] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getUnassignedProgramSessions(request, reply as any);

    expect(expandSiteIdsWithDescendants).toHaveBeenCalledWith([10]);
    expect(Site.findAll).toHaveBeenCalledWith({
      where: {
        programId: 2,
        id: { [Op.in]: [10, 11] },
      },
      attributes: ['id'],
    });
    expect(Session.count).toHaveBeenCalledWith({
      where: {
        siteId: { [Op.in]: [11] },
        collectionCycleId: null,
      },
    });
  });

  it('does not apply site access restriction for unrestricted callers', async () => {
    (expandSiteIdsWithDescendants as jest.Mock).mockResolvedValue([]);

    const request: any = {
      params: { program_id: 2 },
      query: {},
      siteAccess: { userSites: [] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getUnassignedProgramSessions(request, reply as any);

    expect(Site.findAll).toHaveBeenCalledWith({
      where: { programId: 2 },
      attributes: ['id'],
    });
  });
});
