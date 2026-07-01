import { Op } from 'sequelize';
import { getSessionFormAnswers } from './getAnswers';
import {
  Form,
  FormAnswer,
  Session,
} from '../../../db/models';

jest.mock('../../../db/models', () => ({
  Session: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Site: {},
  Program: {},
  Form: {
    findOne: jest.fn(),
  },
  FormAnswer: {
    findAll: jest.fn(),
  },
  FormQuestion: {},
  SessionUnit: {},
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
  };
}

function createRequest(params: { session_id: string }, query: { version?: string } = {}) {
  return {
    params,
    query,
    log: { error: jest.fn() },
  };
}

function buildSession(programFormVersion = 'v2') {
  const program = { id: 10, formVersion: programFormVersion };
  const site = {
    id: 5,
    programId: program.id,
    get: (key: string) => (key === 'program' ? program : undefined),
  };
  return {
    id: 42,
    get: (key: string) => (key === 'site' ? site : undefined),
  };
}

function buildForm(overrides: Partial<{ id: number; version: string; name: string; programId: number }> = {}) {
  return {
    id: 100,
    programId: 10,
    name: 'Survey',
    version: 'v1',
    ...overrides,
  };
}

function buildAnswer(overrides: Partial<Record<string, unknown>> = {}) {
  const submittedAt = new Date('2026-01-15T12:00:00.000Z');
  const question = {
    parentId: null,
    prerequisite: null,
    label: 'House number',
    type: 'text',
    required: true,
    answerScope: 'SESSION',
    isUnitIdentityComponent: false,
    options: null,
  };

  return {
    id: 1,
    frontendId: 'fe-1',
    sessionUnitId: null,
    questionId: 501,
    value: '12A',
    dataType: 'text',
    submittedAt,
    createdAt: submittedAt,
    updatedAt: submittedAt,
    get: (key: string) => {
      if (key === 'question') return question;
      if (key === 'sessionUnit') return undefined;
      return undefined;
    },
    ...overrides,
  };
}

describe('getSessionFormAnswers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Session.findByPk as jest.Mock).mockResolvedValue(buildSession());
    (FormAnswer.findAll as jest.Mock).mockResolvedValue([]);
  });

  it('uses the latest answered form version when version is omitted', async () => {
    const answeredForm = buildForm({ id: 100, version: 'v1' });
    const currentForm = buildForm({ id: 200, version: 'v2' });

    (Form.findOne as jest.Mock).mockImplementation((options: { include?: Array<{ as: string }>; where?: { version?: string } }) => {
      if (options.include?.some((entry) => entry.as === 'answers')) {
        return answeredForm;
      }
      if (options.where?.version === 'v2') {
        return currentForm;
      }
      return null;
    });

    const answers = [buildAnswer()];
    (FormAnswer.findAll as jest.Mock).mockResolvedValue(answers);

    const request = createRequest({ session_id: '42' });
    const reply = createReply();

    await getSessionFormAnswers(request as any, reply as any);

    expect(Form.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programId: 10,
          version: { [Op.ne]: '' },
        }),
        include: expect.arrayContaining([
          expect.objectContaining({
            as: 'answers',
            where: { sessionId: 42 },
            required: true,
          }),
        ]),
      })
    );
    expect(Form.findOne).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 10, version: 'v2' },
      })
    );
    expect(FormAnswer.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 42, formId: 100 },
      })
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        formId: 100,
        formVersion: 'v1',
        sessionId: 42,
        answers: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            questionId: 501,
            label: 'House number',
            value: '12A',
          }),
        ]),
      })
    );
  });

  it('falls back to program formVersion when no answered form exists', async () => {
    const currentForm = buildForm({ id: 200, version: 'v2' });

    (Form.findOne as jest.Mock).mockImplementation((options: { include?: Array<{ as: string }>; where?: { version?: string } }) => {
      if (options.include?.some((entry) => entry.as === 'answers')) {
        return null;
      }
      if (options.where?.version === 'v2') {
        return currentForm;
      }
      return null;
    });

    const request = createRequest({ session_id: '42' });
    const reply = createReply();

    await getSessionFormAnswers(request as any, reply as any);

    expect(Form.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 10, version: 'v2' },
      })
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        formId: 200,
        formVersion: 'v2',
        answers: [],
      })
    );
  });

  it('uses an explicit version query param instead of latest answered form', async () => {
    const requestedForm = buildForm({ id: 150, version: 'v1.5' });

    (Form.findOne as jest.Mock).mockImplementation((options: { include?: Array<{ as: string }>; where?: { version?: string } }) => {
      if (options.include?.some((entry) => entry.as === 'answers')) {
        throw new Error('should not resolve latest answered form when version is explicit');
      }
      if (options.where?.version === 'v1.5') {
        return requestedForm;
      }
      return null;
    });

    const request = createRequest({ session_id: '42' }, { version: 'v1.5' });
    const reply = createReply();

    await getSessionFormAnswers(request as any, reply as any);

    expect(Form.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 10, version: 'v1.5' },
      })
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        formId: 150,
        formVersion: 'v1.5',
      })
    );
  });

  it('returns 404 when session is not found', async () => {
    (Session.findByPk as jest.Mock).mockResolvedValue(null);
    (Session.findOne as jest.Mock).mockResolvedValue(null);

    const request = createRequest({ session_id: '999' });
    const reply = createReply();

    await getSessionFormAnswers(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Session not found' });
    expect(FormAnswer.findAll).not.toHaveBeenCalled();
  });

  it('returns 500 when loading answers fails', async () => {
    const answeredForm = buildForm({ id: 100, version: 'v1' });
    (Form.findOne as jest.Mock).mockResolvedValue(answeredForm);
    (FormAnswer.findAll as jest.Mock).mockRejectedValue(new Error('db error'));

    const request = createRequest({ session_id: '42' });
    const reply = createReply();

    await getSessionFormAnswers(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Failed to get form answers' });
  });
});
