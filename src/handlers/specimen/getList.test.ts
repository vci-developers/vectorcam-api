import { Op } from 'sequelize';
import { getSpecimenList } from './getList';
import { Specimen, Site } from '../../db/models';
import { expandSiteIdsWithDescendants } from '../site/common';

jest.mock('../../db/models', () => ({
  Specimen: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  Session: {},
  Site: {
    findAll: jest.fn(),
  },
  SpecimenImage: {},
}));

jest.mock('../site/common', () => ({
  expandSiteIdsWithDescendants: jest.fn(),
  buildSiteSubtreeWhere: jest.fn(() => ({ __subtree: true })),
}));

jest.mock('./common', () => ({
  formatSpecimenResponse: jest.fn(async (specimen) => specimen),
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
  };
}

describe('getSpecimenList hierarchy filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Specimen.count as jest.Mock).mockResolvedValue(0);
    (Specimen.findAll as jest.Mock).mockResolvedValue([]);
  });

  it('expands accessible site ids for restricted users', async () => {
    (expandSiteIdsWithDescendants as jest.Mock).mockResolvedValue([1, 2]);

    const request: any = {
      query: {},
      siteAccess: { userSites: [1] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenList(request, reply as any);

    expect(expandSiteIdsWithDescendants).toHaveBeenCalledWith([1]);
    const countInclude = (Specimen.count as jest.Mock).mock.calls[0][0].include;
    const siteWhere = countInclude[0].include[0].where;
    expect(siteWhere.id[Op.in]).toEqual([1, 2]);
  });

  it('pushes district hasData filter into site query', async () => {
    (expandSiteIdsWithDescendants as jest.Mock).mockResolvedValue([1, 2]);
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 2 }]);

    const request: any = {
      query: { district: 'Kampala' },
      siteAccess: { userSites: [1] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenList(request, reply as any);

    expect(Site.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          district: 'Kampala',
          hasData: true,
        }),
      })
    );
  });
});
