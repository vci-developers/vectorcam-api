import { exportAnnotationsCSV } from './export';
import { Annotation } from '../../db/models';

jest.mock('../../db/models', () => ({
  Annotation: { findAll: jest.fn() },
  AnnotationTask: {},
  User: {},
  Specimen: {},
  SpecimenImage: {},
  InferenceResult: {},
  Session: {},
  Site: {},
  Program: {},
}));

jest.mock('../../config/environment', () => ({
  config: { server: { domain: 'http://test' } },
}));

jest.mock('../site/common', () => ({
  buildSiteSubtreeWhere: jest.fn(),
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
  };
}

describe('exportAnnotationsCSV programId filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Annotation.findAll as jest.Mock).mockResolvedValue([]);
  });

  it('filters by programId on Site, not nested Program', async () => {
    const request: any = {
      query: { programId: '42' },
      log: { error: jest.fn() },
    };
    const reply = createReply();

    await exportAnnotationsCSV(request, reply as any);

    const include = (Annotation.findAll as jest.Mock).mock.calls[0][0].include;
    const specimenInclude = include[2];
    const sessionInclude = specimenInclude.include[1];
    const siteInclude = sessionInclude.include[0];
    const programInclude = siteInclude.include[0];

    expect(specimenInclude.required).toBe(true);
    expect(sessionInclude.required).toBe(true);
    expect(siteInclude.required).toBe(true);
    expect(siteInclude.where.programId).toBe(42);
    expect(programInclude.where).toBeUndefined();
  });
});
