import { FastifyRequest, FastifyReply } from 'fastify';
import { Form, FormQuestion } from '../../../../db/models';
import sequelize from '../../../../db/index';
import { serializeQuestion } from '../common';

interface UpdateQuestionBody {
  label?: string;
  type?: string;
  required?: boolean;
  options?: unknown[] | null;
  order?: number | null;
  parentId?: number | null;
}

export const schema = {
  tags: ['Programs'],
  description: 'Update a question on a draft form',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      question_id: { type: 'string' },
    },
    required: ['program_id', 'question_id'],
  },
  body: {
    type: 'object',
    properties: {
      label: { type: 'string' },
      type: { type: 'string' },
      required: { type: 'boolean' },
      options: { type: ['array', 'null'] },
      order: { type: ['number', 'null'] },
      parentId: { type: ['number', 'null'] },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        question: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            formId: { type: 'number' },
            parentId: { type: ['number', 'null'] },
            label: { type: 'string' },
            type: { type: 'string' },
            required: { type: 'boolean' },
            options: { type: ['array', 'null'] },
            order: { type: ['number', 'null'] },
            createdAt: { type: ['number', 'null'] },
            updatedAt: { type: ['number', 'null'] },
          },
        },
      },
    },
  },
};

export async function updateProgramFormQuestion(
  request: FastifyRequest<{ Params: { program_id: string; question_id: string }; Body: UpdateQuestionBody }>,
  reply: FastifyReply
): Promise<void> {
  const transaction = await sequelize.transaction();

  try {
    const programId = parseInt(request.params.program_id, 10);
    const questionId = parseInt(request.params.question_id, 10);

    if (isNaN(programId) || isNaN(questionId)) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Invalid ids' });
    }

    const form = await Form.findOne({ where: { programId, version: '' }, transaction });
    if (!form) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Draft form not found for this program' });
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

    await question.update(
      {
        label: request.body.label ?? question.label,
        type: request.body.type ?? question.type,
        required: request.body.required ?? question.required,
        options: request.body.options ?? question.options,
        order: request.body.order ?? question.order,
        parentId,
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
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to update question' });
  }
}

