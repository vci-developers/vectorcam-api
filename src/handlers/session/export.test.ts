import { exportSessionsCSV } from './export';
import { Session } from '../../db/models';

jest.mock('../../db/models', () => ({
  Session: { findAll: jest.fn() },
  Site: {},
  Device: {},
  Program: {},
}));

jest.mock('../site/common', () => ({
  formatSiteResponse: jest.fn(async () => ({})),
  siteIdInSubtreeOfLiteral: jest.fn(),
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
  };
}

describe('exportSessionsCSV programId filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Session.findAll as jest.Mock).mockResolvedValue([]);
  });

  it('filters by programId on Site, not nested Program', async () => {
    const request: any = {
      query: { programId: '42' },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await exportSessionsCSV(request, reply as any);

    const include = (Session.findAll as jest.Mock).mock.calls[0][0].include;
    const siteInclude = include[0];
    const programInclude = siteInclude.include[0];

    expect(siteInclude.required).toBe(true);
    expect(siteInclude.where.programId).toBe(42);
    expect(programInclude.where).toBeUndefined();
  });
});
