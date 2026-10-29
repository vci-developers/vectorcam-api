import { FastifyRequest, FastifyReply } from 'fastify';
import { UniqueConstraintError } from 'sequelize';
import sequelize from '../../../../db/index';
import { FormQuestion } from '../../../../db/models';
import { isQuestionKeyTaken, normalizeQuestionKey } from '../../../../utils/formQuestionKey';
import { serializeQuestion, validateQuestionScopeConfig } from '../../form/common';
import { findDraftFormVersion, resolveProgramFormRouteContext } from '../common';

interface CreateQuestionBody {
  label: string;
  type: string;
  questionKey?: string;
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
  description: 'Create a question on a logical program form draft',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      program_form_id: { type: 'string' },
    },
    required: ['program_id', 'program_form_id'],
  },
  body: {
    type: 'object',
    required: ['label', 'type'],
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
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        question: { type: 'object' },
      },
    },
  },
};

export async function createProgramFormDefinitionQuestion(
  request: FastifyRequest<{
    Params: { program_id: string; program_form_id: string };
    Body: CreateQuestionBody;
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

    const form = await findDraftFormVersion(context.programFormId, transaction);
    if (!form) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Draft form not found for this program form' });
    }

    let parentId = request.body.parentId ?? null;
    if (parentId !== null) {
      const parent = await FormQuestion.findOne({ where: { id: parentId, formId: form.id }, transaction });
      if (!parent) {
        await transaction.rollback();
        return reply.code(400).send({ error: 'Parent question not found in this form' });
      }
    }

    const scopeError = validateQuestionScopeConfig(request.body);
    if (scopeError) {
      await transaction.rollback();
      return reply.code(400).send({ error: scopeError });
    }

    let questionKey: string | undefined;
    if (request.body.questionKey !== undefined) {
      const normalized = normalizeQuestionKey(request.body.questionKey);
      if ('error' in normalized) {
        await transaction.rollback();
        return reply.code(400).send({ error: normalized.error });
      }

      questionKey = normalized.key;
      const taken = await isQuestionKeyTaken(form.id, questionKey, { transaction });
      if (taken) {
        await transaction.rollback();
        return reply.code(409).send({ error: 'A question with this questionKey already exists on this form' });
      }
    }

    const question = await FormQuestion.create(
      {
        formId: form.id,
        parentId,
        prerequisite: request.body.prerequisite ?? null,
        label: request.body.label,
        ...(questionKey !== undefined ? { questionKey } : {}),
        type: request.body.type,
        required: request.body.required ?? false,
        options: request.body.options ?? null,
        order: request.body.order ?? null,
        answerScope: request.body.answerScope ?? 'SESSION',
        isUnitIdentityComponent: request.body.isUnitIdentityComponent ?? false,
      },
      { transaction }
    );

    await transaction.commit();

    return reply.code(201).send({
      message: 'Question created',
      question: serializeQuestion(question),
    });
  } catch (error) {
    await transaction.rollback();
    if (error instanceof UniqueConstraintError) {
      return reply.code(409).send({ error: 'A question with this questionKey already exists on this form' });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to create question' });
  }
}
