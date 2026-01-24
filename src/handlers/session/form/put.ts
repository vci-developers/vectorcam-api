import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../../db/index';
import { FormAnswer } from '../../../db/models';
import { fetchQuestionsMap, FormAnswerInput, loadSessionAndForm } from './common';

interface UpdateAnswersBody {
  answers: FormAnswerInput[];
  submittedAt?: number;
  formVersion?: string;
}

export const schema = {
  tags: ['Sessions'],
  description: 'Update or upsert form answers for a session',
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
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  },
};

export async function updateSessionFormAnswers(
  request: FastifyRequest<{ Params: { session_id: string }; Body: UpdateAnswersBody }>,
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
    }

    const submittedAt = request.body.submittedAt ? new Date(request.body.submittedAt) : new Date();
    const now = new Date();

    await FormAnswer.bulkCreate(
      request.body.answers.map(answer => ({
        sessionId: context.session.id,
        formId: context.form.id,
        questionId: answer.questionId,
        value: answer.value,
        dataType: answer.dataType || 'text',
        submittedAt,
        updatedAt: now,
      })),
      {
        transaction,
        updateOnDuplicate: ['value', 'data_type', 'submitted_at', 'updated_at'],
      }
    );

    await transaction.commit();

    return reply.send({ message: 'Form answers upserted successfully' });
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to update form answers' });
  }
}

