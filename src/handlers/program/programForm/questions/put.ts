import { FastifyRequest, FastifyReply } from 'fastify';
import { UniqueConstraintError } from 'sequelize';
import sequelize from '../../../../db/index';
import { FormQuestion } from '../../../../db/models';
import { isQuestionKeyTaken, normalizeQuestionKey } from '../../../../utils/formQuestionKey';
import { serializeQuestion, validateQuestionScopeConfig } from '../../form/common';
import { findDraftFormVersion, resolveProgramFormRouteContext } from '../common';

interface UpdateQuestionBody {
  label?: string;
  questionKey?: string;
  type?: string;
  required?: boolean;
  options?: unknown[] | null;
  order?: number | null;
  parentId?: number | null;
  prerequisite?: unknown | null;
  answerScope?: 'SESSION' | 'SESSION_UNIT';
  isUnitIdentityComponent?: boolean;
}

export const schema = {
  tags: ['Programs'],
  description: 'Update a question on a logical program form draft',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      program_form_id: { type: 'string' },
      question_id: { type: 'string' },
    },
    required: ['program_id', 'program_form_id', 'question_id'],
  },
  body: {
    type: 'object',
    properties: {
      label: { type: 'string' },
      questionKey: { type: 'string', minLength: 1, maxLength: 64 },
      type: { type: 'string' },
      required: { type: 'boolean' },
      options: { type: ['array', 'null'] },
      order: { type: ['number', 'null'] },
      parentId: { type: ['number', 'null'] },
      prerequisite: {},
      answerScope: { type: 'string', enum: ['SESSION', 'SESSION_UNIT'] },
      isUnitIdentityComponent: { type: 'boolean' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        question: { type: 'object' },
      },
    },
  },
};

export async function updateProgramFormDefinitionQuestion(
  request: FastifyRequest<{
    Params: { program_id: string; program_form_id: string; question_id: string };
    Body: UpdateQuestionBody;
  }>,
  reply: FastifyReply
): Promise<void> {
  const transaction = await sequelize.transaction();

  try {
    const context = await resolveProgramFormRouteContext(request, reply, request.params);
    if (!context) {
      await transaction.rollback();
      return;
    }

    const questionId = parseInt(request.params.question_id, 10);
    if (isNaN(questionId)) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Invalid question id' });
    }

    const form = await findDraftFormVersion(context.programFormId, transaction);
    if (!form) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Draft form not found for this program form' });
    }

    const question = await FormQuestion.findOne({ where: { id: questionId, formId: form.id }, transaction });
    if (!question) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Question not found' });
    }

    let parentId = request.body.parentId ?? question.parentId ?? null;
    if (parentId !== null) {
      if (parentId === question.id) {
        await transaction.rollback();
        return reply.code(400).send({ error: 'Question cannot be its own parent' });
      }

      const parent = await FormQuestion.findOne({ where: { id: parentId, formId: form.id }, transaction });
      if (!parent) {
        await transaction.rollback();
        return reply.code(400).send({ error: 'Parent question not found in this form' });
      }
    }

    let nextQuestionKey = question.questionKey;
    if (request.body.questionKey !== undefined) {
      const normalized = normalizeQuestionKey(request.body.questionKey);
      if ('error' in normalized) {
        await transaction.rollback();
        return reply.code(400).send({ error: normalized.error });
      }

      nextQuestionKey = normalized.key;
      if (nextQuestionKey !== question.questionKey) {
        const taken = await isQuestionKeyTaken(form.id, nextQuestionKey, {
          transaction,
          excludeQuestionId: question.id,
        });
        if (taken) {
          await transaction.rollback();
          return reply.code(409).send({ error: 'A question with this questionKey already exists on this form' });
        }
      }
    }

    const nextAnswerScope = request.body.answerScope ?? question.answerScope;
    const nextIsIdentity = request.body.isUnitIdentityComponent ?? question.isUnitIdentityComponent;
    const nextRequired = request.body.required ?? question.required;
    const scopeError = validateQuestionScopeConfig({
      answerScope: nextAnswerScope,
      isUnitIdentityComponent: nextIsIdentity,
      required: nextRequired,
    });
    if (scopeError) {
      await transaction.rollback();
      return reply.code(400).send({ error: scopeError });
    }

    await question.update(
      {
        label: request.body.label ?? question.label,
        questionKey: nextQuestionKey,
        type: request.body.type ?? question.type,
        required: request.body.required ?? question.required,
        options: request.body.options ?? question.options,
        order: request.body.order ?? question.order,
        parentId,
        prerequisite: request.body.prerequisite !== undefined ? request.body.prerequisite : (question.prerequisite ?? null),
        answerScope: nextAnswerScope,
        isUnitIdentityComponent: nextIsIdentity,
      },
      { transaction }
    );

    await transaction.commit();

    return reply.send({
      message: 'Question updated',
      question: serializeQuestion(question),
    });
  } catch (error) {
    await transaction.rollback();
    if (error instanceof UniqueConstraintError) {
      return reply.code(409).send({ error: 'A question with this questionKey already exists on this form' });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to update question' });
  }
}
