import { exportSpecimensCSV } from './export';
import { Specimen } from '../../db/models';

jest.mock('../../db/models', () => ({
  Specimen: { findAll: jest.fn() },
  Session: {},
  Site: {},
  Device: {},
  Program: {},
  SpecimenImage: { findAll: jest.fn() },
  InferenceResult: {},
}));

jest.mock('../../config/environment', () => ({
  config: { server: { domain: 'http://test' } },
}));

jest.mock('../site/common', () => ({
  formatSiteResponse: jest.fn(async () => ({})),
  buildSiteSubtreeWhere: jest.fn(),
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
  };
}

describe('exportSpecimensCSV programId filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Specimen.findAll as jest.Mock).mockResolvedValue([]);
    const { SpecimenImage } = jest.requireMock('../../db/models');
    SpecimenImage.findAll.mockResolvedValue([]);
  });

  it('filters by programId on Site, not nested Program', async () => {
    const request: any = {
      query: { programId: '42' },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await exportSpecimensCSV(request, reply as any);

    const include = (Specimen.findAll as jest.Mock).mock.calls[0][0].include;
    const sessionInclude = include[0];
    const siteInclude = sessionInclude.include[0];
    const programInclude = siteInclude.include[0];

    expect(sessionInclude.required).toBe(true);
    expect(siteInclude.required).toBe(true);
    expect(siteInclude.where.programId).toBe(42);
    expect(programInclude.where).toBeUndefined();
  });
});
