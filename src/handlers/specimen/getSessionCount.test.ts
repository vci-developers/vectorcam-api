import { Op } from 'sequelize';
import { getSpecimenSessionCount } from './getSessionCount';
import { Site } from '../../db/models';

jest.mock('../../db/models', () => ({
  Site: {
    findAll: jest.fn(),
  },
}));

jest.mock('../../db/index', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock('../site/common', () => ({
  expandSiteIdsWithDescendants: jest.fn(async (ids: number[]) => ids),
  buildSiteSubtreeWhere: jest.fn(),
  parseSiteIds: jest.fn((value?: string) =>
    value
      ? value.split(',').map((entry) => Number(entry.trim())).filter((id) => Number.isInteger(id) && id > 0)
      : []
  ),
}));

import sequelize from '../../db/index';

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
  };
}

describe('getSpecimenSessionCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when programId is missing', async () => {
    const request: any = {
      query: {},
      siteAccess: { canRead: true, userSites: [] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenSessionCount(request, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'programId must be a positive integer' });
  });

  it('scopes sites by program and user access', async () => {
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 10 }]);
    (sequelize.query as jest.Mock).mockResolvedValue([]);

    const request: any = {
      query: { programId: 5 },
      siteAccess: { canRead: true, userSites: [10] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenSessionCount(request, reply as any);

    expect(Site.findAll).toHaveBeenCalledWith({
      where: { programId: 5, id: { [Op.in]: [10] } },
      attributes: ['id'],
    });
    expect(reply.send).toHaveBeenCalledWith({ sessions: [] });
  });

  it('aggregates groups and image counts per session', async () => {
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 1 }]);
    (sequelize.query as jest.Mock)
      .mockResolvedValueOnce([
        {
          sessionId: 100,
          species: 'An. gambiae',
          sex: 'F',
          abdomenStatus: 'Fed',
          count: 6,
        },
        {
          sessionId: 100,
          species: 'An. gambiae',
          sex: 'M',
          abdomenStatus: null,
          count: 4,
        },
      ])
      .mockResolvedValueOnce([{ sessionId: 100, imageCount: 85 }]);

    const request: any = {
      query: { programId: 1 },
      siteAccess: { canRead: true, userSites: [] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenSessionCount(request, reply as any);

    expect(reply.send).toHaveBeenCalledWith({
      sessions: [
        {
          sessionId: 100,
          specimenCount: 10,
          imageCount: 85,
          groups: [
            { species: 'An. gambiae', sex: 'F', abdomenStatus: 'Fed', count: 6 },
            { species: 'An. gambiae', sex: 'M', abdomenStatus: null, count: 4 },
          ],
        },
      ],
    });
  });

  it('returns 400 when start date is after end date', async () => {
    const request: any = {
      query: { programId: 1, startDate: '2025-02-01', endDate: '2025-01-01' },
      siteAccess: { canRead: true, userSites: [] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenSessionCount(request, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Start date must be before or equal to end date' });
  });

  it('applies session filters to grouping query', async () => {
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 1 }]);
    (sequelize.query as jest.Mock).mockResolvedValue([]);

    const request: any = {
      query: {
        programId: 1,
        sessionType: 'SURVEILLANCE',
        sessionId: '42',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      },
      siteAccess: { canRead: true, userSites: [] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenSessionCount(request, reply as any);

    const groupQuery = (sequelize.query as jest.Mock).mock.calls[0][0] as string;
    const replacements = (sequelize.query as jest.Mock).mock.calls[0][1].replacements;

    expect(groupQuery).toContain('sess.type = :sessionType');
    expect(groupQuery).toContain('sess.id = :sessionId');
    expect(groupQuery).toContain('sess.collection_date >=');
    expect(replacements.sessionType).toBe('SURVEILLANCE');
    expect(replacements.sessionId).toBe('42');
  });

  it('adds hasImages filter to specimen grouping query', async () => {
    (Site.findAll as jest.Mock).mockResolvedValue([{ id: 1 }]);
    (sequelize.query as jest.Mock).mockResolvedValue([]);

    const request: any = {
      query: { programId: 1, hasImages: true },
      siteAccess: { canRead: true, userSites: [] },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getSpecimenSessionCount(request, reply as any);

    const groupQuery = (sequelize.query as jest.Mock).mock.calls[0][0] as string;
    expect(groupQuery).toContain('EXISTS (SELECT 1 FROM specimen_images img WHERE img.specimen_id = sp.id)');
  });
});
