import { Op } from 'sequelize';
import { getSiteList } from './getList';
import { Site } from '../../db/models';

jest.mock('../../db/models', () => ({
  Site: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
}));

jest.mock('./common', () => ({
  formatSiteResponse: jest.fn(async (site: any) => ({
    siteId: site.id,
    programId: site.programId ?? 1,
    isActive: true,
    hasData: false,
    locationHierarchy: {},
  })),
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
  };
}

describe('getSiteList location hierarchy filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Site.count as jest.Mock).mockResolvedValue(0);
    (Site.findAll as jest.Mock).mockResolvedValue([]);
  });

  it('builds location filter against ordered hierarchy array', async () => {
    const request: any = {
      query: { locationTypeKey: 'district', locationTypeValue: 'Kampala' },
      log: { error: jest.fn() },
      siteAccess: { userSites: [] },
    };
    const reply = createReply();

    await getSiteList(request, reply as any);

    const whereArg = (Site.count as jest.Mock).mock.calls[0][0].where;
    expect(whereArg[Op.and]).toBeDefined();
    expect(whereArg[Op.and]).toHaveLength(1);
  });
});
