import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../../db/index';
import { FormAnswer } from '../../../db/models';
import { fetchQuestionsMap, FormAnswerInput, loadSessionAndForm } from './common';

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
        answers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
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

    const existingCount = await FormAnswer.count({
      where: { sessionId: context.session.id, formId: context.form.id },
      transaction,
    });

    if (existingCount > 0) {
      await transaction.rollback();
      return reply.code(409).send({ error: 'Answers already exist for this session and form' });
    }

    const questionsMap = await fetchQuestionsMap(context.form.id);

    for (const answer of request.body.answers) {
      if (!questionsMap.has(answer.questionId)) {
        await transaction.rollback();
        return reply.code(400).send({ error: `Question ${answer.questionId} does not belong to this form` });
      }
    }

    const submittedAt = request.body.submittedAt ? new Date(request.body.submittedAt) : new Date();

    const created = await FormAnswer.bulkCreate(
      request.body.answers.map(answer => ({
        sessionId: context.session.id,
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
      answers: created.map(a => ({
        id: a.id,
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
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to submit form answers' });
  }
}

