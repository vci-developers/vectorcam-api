import { exportFormAnswersCSV } from './exportAnswers';
import { FormAnswer } from '../../../db/models';

jest.mock('../../../db/models', () => ({
  FormAnswer: { findAll: jest.fn() },
  Form: {},
  FormQuestion: {},
  Session: {},
  Site: {},
  Program: {},
}));

function createReply() {
  return {
    send: jest.fn(),
    code: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
  };
}

function answerRow(fields: {
  id: number;
  sessionId: number;
  sessionUnitId: number | null;
  questionId: number;
  value: string;
  answerScope: 'SESSION' | 'SESSION_UNIT';
  questionKey: string;
}) {
  const associations: Record<string, unknown> = {
    form: {
      id: 7,
      name: 'Household',
      version: '1',
      get: (key: string) => (key === 'program' ? { id: 3, name: 'Program' } : undefined),
    },
    session: {
      frontendId: 'sess-fe',
      get: (key: string) => (key === 'site' ? { id: 9 } : undefined),
    },
    question: {
      label: 'House number',
      type: 'text',
      required: true,
      answerScope: fields.answerScope,
      questionKey: fields.questionKey,
    },
  };

  return {
    id: fields.id,
    sessionId: fields.sessionId,
    sessionUnitId: fields.sessionUnitId,
    questionId: fields.questionId,
    value: fields.value,
    dataType: 'text',
    submittedAt: new Date('2026-01-02T00:00:00.000Z'),
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    get: (key: string) => associations[key],
  };
}

describe('exportFormAnswersCSV', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes session unit, answer scope, and question key for unit-level answers', async () => {
    (FormAnswer.findAll as jest.Mock).mockResolvedValue([
      answerRow({
        id: 1,
        sessionId: 10,
        sessionUnitId: null,
        questionId: 20,
        value: 'session-level',
        answerScope: 'SESSION',
        questionKey: 'collector_name',
      }),
      answerRow({
        id: 2,
        sessionId: 10,
        sessionUnitId: 55,
        questionId: 21,
        value: 'unit-level',
        answerScope: 'SESSION_UNIT',
        questionKey: 'house_number',
      }),
    ]);

    const reply = createReply();
    await exportFormAnswersCSV({ query: {} } as any, reply as any);

    const csv = reply.send.mock.calls[0][0] as string;
    const [header, sessionRow, unitRow] = csv.trim().split('\n');

    expect(header).toBe(
      'AnswerID,FormID,FormName,FormVersion,ProgramID,ProgramName,SessionID,SessionFrontendID,SiteID,QuestionID,QuestionLabel,QuestionType,Required,Value,DataType,SubmittedAt,CreatedAt,UpdatedAt,SessionUnitID,AnswerScope,QuestionKey'
    );
    expect(sessionRow.endsWith(',,SESSION,collector_name')).toBe(true);
    expect(unitRow.endsWith(',55,SESSION_UNIT,house_number')).toBe(true);
  });
});
