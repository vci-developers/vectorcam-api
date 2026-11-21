import { Op } from 'sequelize';
import { getSpecimenList } from './getList';
import { Specimen, Site } from '../../db/models';
import { assignedSitesAccess, unrestrictedAccess } from '../../test/access';

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

  it('restricts specimens to accessible site ids', async () => {
    const request: any = {
      query: {},
      access: assignedSitesAccess([1, 2]),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenList(request, reply as any);

    const countInclude = (Specimen.count as jest.Mock).mock.calls[0][0].include;
    const sessionInclude = countInclude.find((entry: any) => entry.as === 'session');
    const siteWhere = sessionInclude.include[0].where;
    expect(siteWhere.id[Op.in]).toEqual([1, 2]);
  });

  it('pushes district hasData filter into site query', async () => {
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 2 }]);

    const request: any = {
      query: { district: 'Kampala' },
      access: assignedSitesAccess([1, 2]),
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

  it('filters by sessionUnitId and collectionCycleId', async () => {
    const request: any = {
      query: { sessionUnitId: 42, collectionCycleId: 7 },
      access: unrestrictedAccess(),
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenList(request, reply as any);

    const countArgs = (Specimen.count as jest.Mock).mock.calls[0][0];
    const sessionInclude = countArgs.include.find((entry: any) => entry.as === 'session');
    expect(countArgs.where.sessionUnitId).toBe(42);
    expect(sessionInclude.where.collectionCycleId).toBe(7);
  });
});
