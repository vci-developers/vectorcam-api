import { Op } from 'sequelize';
import getAnnotationList from './getList';
import { Annotation, AnnotationTask } from '../../db/models';
import { buildSiteSubtreeWhere } from '../site/common';

jest.mock('../../db/models', () => ({
  Annotation: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  AnnotationTask: {
    findAll: jest.fn(),
  },
  User: {},
  Specimen: {},
  Session: {},
  Site: {},
  SpecimenImage: {},
}));

jest.mock('../site/common', () => ({
  buildSiteSubtreeWhere: jest.fn(() => ({ __subtree: true })),
}));

jest.mock('./common', () => ({
  formatAnnotationResponse: jest.fn(async (annotation) => annotation),
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
  };
}

describe('getAnnotationList filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Annotation.count as jest.Mock).mockResolvedValue(0);
    (Annotation.findAll as jest.Mock).mockResolvedValue([]);
    (AnnotationTask.findAll as jest.Mock).mockResolvedValue([]);
  });

  it('filters by annotation creation date, district, and requested site subtree', async () => {
    const request: any = {
      query: {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        district: 'Arua',
        siteId: 10,
      },
      isAdminToken: true,
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getAnnotationList(request, reply as any);

    expect(buildSiteSubtreeWhere).toHaveBeenCalledWith([10]);

    const countOptions = (Annotation.count as jest.Mock).mock.calls[0][0];
    const specimenInclude = countOptions.include[2];
    const sessionInclude = specimenInclude.include[1];
    const siteInclude = sessionInclude.include[0];

    expect(countOptions.where.createdAt[Op.gte]).toEqual(new Date('2026-01-01'));
    expect(countOptions.where.createdAt[Op.lte]).toEqual(new Date('2026-01-31T23:59:59.999Z'));
    expect(specimenInclude.required).toBe(true);
    expect(sessionInclude.required).toBe(true);
    expect(siteInclude.required).toBe(true);
    expect(siteInclude.where.hasData).toBe(true);
    expect(siteInclude.where.district).toBe('Arua');
    expect(siteInclude.where[Op.and]).toEqual([{ __subtree: true }]);

    const findOptions = (Annotation.findAll as jest.Mock).mock.calls[0][0];
    expect(findOptions.include[2].include[1].include[0].where).toBe(siteInclude.where);
  });

  it('rejects an inverted date range', async () => {
    const request: any = {
      query: {
        startDate: '2026-02-01',
        endDate: '2026-01-31',
      },
      isAdminToken: true,
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await getAnnotationList(request, reply as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Start date must be before or equal to end date' });
    expect(Annotation.count).not.toHaveBeenCalled();
    expect(Annotation.findAll).not.toHaveBeenCalled();
  });
});
