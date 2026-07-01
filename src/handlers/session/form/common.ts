import { FastifyReply, FastifyRequest } from 'fastify';
import { Op } from 'sequelize';
import { Form, FormAnswer, FormQuestion, Program, Session, SessionUnit, Site } from '../../../db/models';
import { findSession } from '../common';

export interface FormAnswerInput {
  frontendId?: string;
  sessionUnitId?: number | null;
  questionId: number;
  value: unknown;
  dataType?: string;
}

export interface LoadSessionAndFormOptions {
  /** When no explicit version is given, prefer the latest form version that has answers for this session */
  preferLatestAnsweredVersion?: boolean;
}

export async function findLatestFormWithAnswersForSession(
  sessionId: number,
  programId: number
): Promise<Form | null> {
  return Form.findOne({
    where: {
      programId,
      version: { [Op.ne]: '' },
    },
    include: [{
      model: FormAnswer,
      as: 'answers',
      where: { sessionId },
      required: true,
      attributes: [],
    }],
    order: [['updatedAt', 'DESC'], ['id', 'DESC']],
  });
}

export async function loadSessionAndForm(
  request: FastifyRequest,
  reply: FastifyReply,
  sessionParam: string,
  explicitVersion?: string,
  options?: LoadSessionAndFormOptions
): Promise<{ session: Session; form: Form; siteProgramId: number } | null> {
  const session = await findSession(sessionParam, [
    {
      model: Site,
      as: 'site',
      attributes: ['id', 'programId'],
      include: [
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'formVersion'],
        }
      ]
    }
  ]);

  if (!session) {
    reply.code(404).send({ error: 'Session not found' });
    return null;
  }

  const site = session.get('site') as Site | null;
  if (!site) {
    reply.code(400).send({ error: 'Session does not have an associated site' });
    return null;
  }

  let program = site.get('program') as Program | null;
  if (!program) {
    program = await Program.findByPk(site.programId);
  }
  if (!program) {
    reply.code(400).send({ error: 'Session site missing program' });
    return null;
  }

  let form: Form | null = null;

  if (explicitVersion !== undefined) {
    if (explicitVersion === 'draft' || explicitVersion === 'dev' || explicitVersion === '') {
      reply.code(400).send({ error: 'Draft forms cannot be used for answers' });
      return null;
    }
    form = await Form.findOne({
      where: { programId: program.id, version: explicitVersion },
    });
    if (form?.version === '') {
      form = null;
    }
    if (!form) {
      reply.code(404).send({ error: `Requested version "${explicitVersion}" not found or not published` });
      return null;
    }
  } else {
    if (options?.preferLatestAnsweredVersion) {
      form = await findLatestFormWithAnswersForSession(session.id, program.id);
    }

    if (!form && program.formVersion) {
      form = await Form.findOne({ where: { programId: program.id, version: program.formVersion } });
      if (form?.version === '') {
        form = null;
      }

      if (!form) {
        reply.code(404).send({ error: `Program formVersion "${program.formVersion}" not found or not published` });
        return null;
      }
    }

    if (!form) {
      form = await Form.findOne({
        where: { programId: program.id, version: { [Op.ne]: '' } },
        order: [['updatedAt', 'DESC'], ['id', 'DESC']],
      });

      if (!form) {
        reply.code(404).send({ error: 'No published form available for this program' });
        return null;
      }
    }
  }

  return { session, form, siteProgramId: site.programId };
}

export async function fetchQuestionsMap(
  formId: number
): Promise<Map<number, FormQuestion>> {
  const questions = await FormQuestion.findAll({ where: { formId } });
  const questionMap = new Map<number, FormQuestion>();
  questions.forEach(q => questionMap.set(q.id, q));
  return questionMap;
}

export async function validateFormAnswerScopes(
  sessionId: number,
  answers: FormAnswerInput[],
  questionsMap: Map<number, FormQuestion>
): Promise<string | null> {
  const unitIds = Array.from(
    new Set(
      answers
        .map((answer) => answer.sessionUnitId)
        .filter((unitId): unitId is number => unitId !== null && unitId !== undefined)
    )
  );

  const units = unitIds.length > 0
    ? await SessionUnit.findAll({ where: { id: { [Op.in]: unitIds }, sessionId } })
    : [];
  const validUnitIds = new Set(units.map((unit) => unit.id));

  for (const answer of answers) {
    const question = questionsMap.get(answer.questionId);
    if (!question) {
      return `Question ${answer.questionId} does not belong to this form`;
    }

    const hasUnit = answer.sessionUnitId !== null && answer.sessionUnitId !== undefined;
    if (question.answerScope === 'SESSION' && hasUnit) {
      return `Question ${answer.questionId} is session-scoped and cannot include sessionUnitId`;
    }

    if (question.answerScope === 'SESSION_UNIT' && !hasUnit) {
      return `Question ${answer.questionId} is unit-scoped and requires sessionUnitId`;
    }

    if (hasUnit && !validUnitIds.has(answer.sessionUnitId as number)) {
      return `Session unit ${answer.sessionUnitId} does not belong to this session`;
    }
  }

  return null;
}

function normalizeIdentityValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim().toLowerCase();
  return JSON.stringify(value).trim().toLowerCase();
}

export async function validateUniqueUnitsWithinSession(
  sessionId: number,
  formId: number,
  answers: FormAnswerInput[],
  questionsMap: Map<number, FormQuestion>
): Promise<string | null> {
  const identityQuestions = Array.from(questionsMap.values())
    .filter((question) => question.answerScope === 'SESSION_UNIT' && question.isUnitIdentityComponent)
    .sort((a, b) => a.id - b.id);

  if (identityQuestions.length === 0) {
    return null;
  }

  const units = await SessionUnit.findAll({ where: { sessionId } });
  if (units.length < 2) {
    return null;
  }

  const identityQuestionIds = identityQuestions.map((question) => question.id);
  const existingAnswers = await FormAnswer.findAll({
    where: {
      sessionId,
      formId,
      sessionUnitId: { [Op.ne]: null },
      questionId: { [Op.in]: identityQuestionIds },
    },
  });

  const valuesByUnit = new Map<number, Map<number, unknown>>();
  for (const answer of existingAnswers) {
    if (answer.sessionUnitId === null) continue;
    if (!valuesByUnit.has(answer.sessionUnitId)) {
      valuesByUnit.set(answer.sessionUnitId, new Map<number, unknown>());
    }
    valuesByUnit.get(answer.sessionUnitId)!.set(answer.questionId, answer.value);
  }

  for (const answer of answers) {
    const question = questionsMap.get(answer.questionId);
    if (!question?.isUnitIdentityComponent || answer.sessionUnitId === null || answer.sessionUnitId === undefined) {
      continue;
    }
    if (!valuesByUnit.has(answer.sessionUnitId)) {
      valuesByUnit.set(answer.sessionUnitId, new Map<number, unknown>());
    }
    valuesByUnit.get(answer.sessionUnitId)!.set(answer.questionId, answer.value);
  }

  const seenIdentities = new Map<string, number>();
  for (const unit of units) {
    const unitValues = valuesByUnit.get(unit.id);
    if (!unitValues) continue;

    const parts: string[] = [];
    let complete = true;
    for (const question of identityQuestions) {
      const normalized = normalizeIdentityValue(unitValues.get(question.id));
      if (normalized === '') {
        complete = false;
        break;
      }
      parts.push(`${question.id}:${normalized}`);
    }
    if (!complete) continue;

    const identity = parts.join('|');
    const existingUnitId = seenIdentities.get(identity);
    if (existingUnitId !== undefined) {
      return `Duplicate session unit identity for units ${existingUnitId} and ${unit.id}`;
    }
    seenIdentities.set(identity, unit.id);
  }

  return null;
}

