import { Op } from 'sequelize';
import { getSpecimenCount } from './getCount';
import { Site } from '../../db/models';

jest.mock('../../db/models', () => ({
  Specimen: {},
  Session: {},
  Site: {
    findAll: jest.fn(),
  },
  SpecimenImage: {},
}));

jest.mock('../../db/index', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock('../site/common', () => ({
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

describe('getSpecimenCount location hierarchy filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Site.findAll as jest.Mock).mockResolvedValue([]);
  });

  it('builds site filter against ordered hierarchy array', async () => {
    const request: any = {
      query: { locationTypeKey: 'district', locationTypeValue: 'Kampala' },
      siteAccess: { canRead: true, userSites: [] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenCount(request, reply as any);

    const whereArg = (Site.findAll as jest.Mock).mock.calls[0][0].where;
    expect(whereArg[Op.and]).toBeDefined();
    expect(whereArg[Op.and]).toHaveLength(1);
  });
});
