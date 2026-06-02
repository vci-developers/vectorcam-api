import { FastifyRequest, FastifyReply } from 'fastify';
import { UniqueConstraintError } from 'sequelize';
import sequelize from '../../../db/index';
import { FormAnswer } from '../../../db/models';
import {
  fetchQuestionsMap,
  FormAnswerInput,
  loadSessionAndForm,
  validateFormAnswerScopes,
  validateUniqueUnitsWithinSession,
} from './common';

interface CreateAnswersBody {
  answers: FormAnswerInput[];
  submittedAt?: number;
  formVersion?: string;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Submit answers for a published form for a session',
  params: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
    },
    required: ['session_id'],
  },
  body: {
    type: 'object',
    required: ['answers'],
    properties: {
      submittedAt: { type: 'number' },
      formVersion: { type: 'string' },
      answers: {
        type: 'array',
        items: {
          type: 'object',
          required: ['questionId', 'value'],
          properties: {
            frontendId: { type: 'string' },
            sessionUnitId: { type: ['number', 'null'] },
            questionId: { type: 'number' },
            value: {},
            dataType: { type: 'string' },
          },
        },
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        sessionId: { type: 'number' },
        answers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              frontendId: { type: ['string', 'null'] },
              sessionUnitId: { type: ['number', 'null'] },
              questionId: { type: 'number' },
              value: {},
              dataType: { type: 'string' },
              submittedAt: { type: ['number', 'null'] },
              createdAt: { type: ['number', 'null'] },
              updatedAt: { type: ['number', 'null'] },
            },
          },
        },
      },
    },
    409: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export async function createSessionFormAnswers(
  request: FastifyRequest<{ Params: { session_id: string }; Body: CreateAnswersBody }>,
  reply: FastifyReply
): Promise<void> {
  const transaction = await sequelize.transaction();

  try {
    const context = await loadSessionAndForm(request, reply, request.params.session_id, request.body.formVersion);
    if (!context) {
      await transaction.rollback();
      return;
    }

    if (!request.body.answers || request.body.answers.length === 0) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'At least one answer is required' });
    }

    const questionsMap = await fetchQuestionsMap(context.form.id);

    for (const answer of request.body.answers) {
      if (!questionsMap.has(answer.questionId)) {
        await transaction.rollback();
        return reply.code(400).send({ error: `Question ${answer.questionId} does not belong to this form` });
      }

      const existing = await FormAnswer.findOne({
        where: {
          sessionId: context.session.id,
          formId: context.form.id,
          questionId: answer.questionId,
          sessionUnitId: answer.sessionUnitId ?? null,
        },
        transaction,
      });
      if (existing) {
        await transaction.rollback();
        return reply.code(409).send({ error: 'One or more answers already exist for this session/form scope' });
      }
    }

    const scopeError = await validateFormAnswerScopes(context.session.id, request.body.answers, questionsMap);
    if (scopeError) {
      await transaction.rollback();
      return reply.code(400).send({ error: scopeError });
    }

    const identityError = await validateUniqueUnitsWithinSession(
      context.session.id,
      context.form.id,
      request.body.answers,
      questionsMap
    );
    if (identityError) {
      await transaction.rollback();
      return reply.code(409).send({ error: identityError });
    }

    const submittedAt = request.body.submittedAt ? new Date(request.body.submittedAt) : new Date();

    const created = await FormAnswer.bulkCreate(
      request.body.answers.map(answer => ({
        frontendId: answer.frontendId ?? null,
        sessionId: context.session.id,
        sessionUnitId: answer.sessionUnitId ?? null,
        formId: context.form.id,
        questionId: answer.questionId,
        value: answer.value,
        dataType: answer.dataType || 'text',
        submittedAt,
      })),
      { transaction }
    );

    await transaction.commit();

    return reply.code(201).send({
      message: 'Form answers submitted successfully',
      sessionId: context.session.id,
      answers: created.map(a => ({
        id: a.id,
        frontendId: a.frontendId ?? null,
        sessionUnitId: a.sessionUnitId ?? null,
        questionId: a.questionId,
        value: a.value,
        dataType: a.dataType,
        submittedAt: a.submittedAt?.getTime?.() ?? null,
        createdAt: a.createdAt?.getTime?.() ?? null,
        updatedAt: a.updatedAt?.getTime?.() ?? null,
      })),
    });
  } catch (error) {
    await transaction.rollback();
    if (error instanceof UniqueConstraintError) {
      return reply.code(409).send({ error: 'One or more answers already exist for this session/form scope' });
    }

    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to submit form answers' });
  }
}

