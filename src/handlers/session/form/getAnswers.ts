import { FastifyRequest, FastifyReply } from 'fastify';
import { FormAnswer, FormQuestion, SessionUnit } from '../../../db/models';
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
              frontendId: { type: ['string', 'null'] },
              sessionUnitId: { type: ['number', 'null'] },
              sessionUnit: {
                anyOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    properties: {
                      id: { type: 'number' },
                      frontendId: { type: ['string', 'null'] },
                      sessionId: { type: 'number' },
                      unitOrder: { type: 'number' },
                      createdAt: { type: ['number', 'null'] },
                      updatedAt: { type: ['number', 'null'] },
                    },
                  },
                ],
              },
              questionId: { type: 'number' },
              parentId: { type: ['number', 'null'] },
              prerequisite: {},
              label: { type: ['string', 'null'] },
              type: { type: ['string', 'null'] },
              required: { type: ['boolean', 'null'] },
              answerScope: { type: ['string', 'null'] },
              isUnitIdentityComponent: { type: ['boolean', 'null'] },
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
      include: [
        { model: FormQuestion, as: 'question' },
        { model: SessionUnit, as: 'sessionUnit', required: false },
      ],
      order: [['session_unit_id', 'ASC'], ['question_id', 'ASC']],
    });

    return reply.send({
      formId: context.form.id,
      formName: context.form.name,
      formVersion: context.form.version,
      programId: context.form.programId,
      sessionId: context.session.id,
      answers: answers.map(answer => ({
        id: answer.id,
        frontendId: answer.frontendId ?? null,
        sessionUnitId: answer.sessionUnitId ?? null,
        sessionUnit: (() => {
          const unit = answer.get('sessionUnit') as SessionUnit | undefined;
          if (!unit) return null;
          return {
            id: unit.id,
            frontendId: unit.frontendId ?? null,
            sessionId: unit.sessionId,
            unitOrder: unit.unitOrder,
            createdAt: unit.createdAt?.getTime?.() ?? null,
            updatedAt: unit.updatedAt?.getTime?.() ?? null,
          };
        })(),
        questionId: answer.questionId,
        parentId: (answer.get('question') as FormQuestion | undefined)?.parentId ?? null,
        prerequisite: (answer.get('question') as FormQuestion | undefined)?.prerequisite ?? null,
        label: (answer.get('question') as FormQuestion | undefined)?.label ?? null,
        type: (answer.get('question') as FormQuestion | undefined)?.type ?? null,
        required: (answer.get('question') as FormQuestion | undefined)?.required ?? null,
        answerScope: (answer.get('question') as FormQuestion | undefined)?.answerScope ?? null,
        isUnitIdentityComponent: (answer.get('question') as FormQuestion | undefined)?.isUnitIdentityComponent ?? null,
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

