import { FastifyRequest, FastifyReply } from 'fastify';
import { FormAnswer, FormQuestion } from '../../../db/models';
import { loadSessionAndForm } from './common';

export const schema = {
  tags: ['Sessions'],
  description: 'Get form answers for a session and form',
  params: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
    },
    required: ['session_id'],
  },
  querystring: {
    type: 'object',
    properties: {
      version: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        formId: { type: 'number' },
        formName: { type: 'string' },
        formVersion: { type: 'string' },
        programId: { type: 'number' },
        sessionId: { type: 'number' },
        answers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              questionId: { type: 'number' },
              parentId: { type: ['number', 'null'] },
              label: { type: ['string', 'null'] },
              type: { type: ['string', 'null'] },
              required: { type: ['boolean', 'null'] },
              options: { type: ['array', 'null'] },
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

export async function getSessionFormAnswers(
  request: FastifyRequest<{ Params: { session_id: string }; Querystring: { version?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { version } = request.query;

    const context = await loadSessionAndForm(
      request,
      reply,
      request.params.session_id,
      version
    );
    if (!context) return;

    const answers = await FormAnswer.findAll({
      where: { sessionId: context.session.id, formId: context.form.id },
      include: [{ model: FormQuestion, as: 'question' }],
      order: [['question_id', 'ASC']],
    });

    return reply.send({
      formId: context.form.id,
      formName: context.form.name,
      formVersion: context.form.version,
      programId: context.form.programId,
      sessionId: context.session.id,
      answers: answers.map(answer => ({
        id: answer.id,
        questionId: answer.questionId,
        parentId: (answer.get('question') as FormQuestion | undefined)?.parentId ?? null,
        label: (answer.get('question') as FormQuestion | undefined)?.label ?? null,
        type: (answer.get('question') as FormQuestion | undefined)?.type ?? null,
        required: (answer.get('question') as FormQuestion | undefined)?.required ?? null,
        options: (answer.get('question') as FormQuestion | undefined)?.options ?? null,
        value: answer.value,
        dataType: answer.dataType,
        submittedAt: answer.submittedAt?.getTime?.() ?? null,
        createdAt: answer.createdAt?.getTime?.() ?? null,
        updatedAt: answer.updatedAt?.getTime?.() ?? null,
      })),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to get form answers' });
  }
}

