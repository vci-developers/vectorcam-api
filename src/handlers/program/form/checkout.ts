import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../../db/index';
import { Form, FormQuestion } from '../../../db/models';
import { cloneQuestionsToForm, serializeQuestion } from './common';

export const schema = {
  tags: ['Programs'],
  description: 'Checkout a published form into the program draft (version = \'\')',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      version: { type: 'string' },
    },
    required: ['program_id', 'version'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        form: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            programId: { type: 'number' },
            name: { type: 'string' },
            version: { type: 'string' },
            createdAt: { type: ['number', 'null'] },
            updatedAt: { type: ['number', 'null'] },
            questions: {
              type: 'array',
              items: {
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
      },
    },
  },
};

export async function checkoutProgramForm(
  request: FastifyRequest<{ Params: { program_id: string; version: string } }>,
  reply: FastifyReply
): Promise<void> {
  const transaction = await sequelize.transaction();

  try {
    const programId = parseInt(request.params.program_id, 10);
    const version = request.params.version;

    if (isNaN(programId)) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Invalid program id' });
    }

    if (!version || version === '') {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Version is required for checkout' });
    }

    const sourceForm = await Form.findOne({ where: { programId, version }, transaction });
    if (!sourceForm) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Form not found for this program' });
    }

    if (sourceForm.version === '') {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Source form is already a draft' });
    }

    let draft = await Form.findOne({ where: { programId, version: '' }, transaction });

    if (!draft) {
      draft = await Form.create(
        {
          programId,
          name: sourceForm.name,
          version: '',
        },
        { transaction }
      );
    } else {
      await draft.update({ name: sourceForm.name }, { transaction });
      await FormQuestion.destroy({ where: { formId: draft.id }, transaction });
    }

    const clonedQuestions = await cloneQuestionsToForm(sourceForm.id, draft.id, transaction);

    await transaction.commit();

    return reply.code(200).send({
      message: 'Draft updated from published form',
      form: {
        id: draft.id,
        programId: draft.programId,
        name: draft.name,
        version: draft.version,
        createdAt: draft.createdAt?.getTime?.() ?? null,
        updatedAt: draft.updatedAt?.getTime?.() ?? null,
        questions: clonedQuestions.map(serializeQuestion),
      },
    });
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to checkout form' });
  }
}

