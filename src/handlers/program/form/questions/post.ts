import { FastifyRequest, FastifyReply } from 'fastify';
import { Form, FormQuestion } from '../../../../db/models';
import sequelize from '../../../../db/index';
import { serializeQuestion } from '../common';

interface CreateQuestionBody {
  label: string;
  type: string;
  required?: boolean;
  options?: unknown[] | null;
  order?: number | null;
  parentId?: number | null;
}

export const schema = {
  tags: ['Programs'],
  description: 'Create a question on a draft form',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
    },
    required: ['program_id'],
  },
  body: {
    type: 'object',
    required: ['label', 'type'],
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
    201: {
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

export async function createProgramFormQuestion(
  request: FastifyRequest<{ Params: { program_id: string }; Body: CreateQuestionBody }>,
  reply: FastifyReply
): Promise<void> {
  const transaction = await sequelize.transaction();

  try {
    const programId = parseInt(request.params.program_id, 10);

    if (isNaN(programId)) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Invalid program id' });
    }

    const form = await Form.findOne({ where: { programId, version: '' }, transaction });
    if (!form) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Draft form not found for this program' });
    }

    if (form.version !== '') {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Only draft forms can be modified' });
    }

    let parentId = request.body.parentId ?? null;
    if (parentId !== null) {
      const parent = await FormQuestion.findOne({ where: { id: parentId, formId: form.id }, transaction });
      if (!parent) {
        await transaction.rollback();
        return reply.code(400).send({ error: 'Parent question not found in this form' });
      }
    }

    const question = await FormQuestion.create(
      {
        formId: form.id,
        parentId,
        label: request.body.label,
        type: request.body.type,
        required: request.body.required ?? false,
        options: request.body.options ?? null,
        order: request.body.order ?? null,
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
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to create question' });
  }
}

