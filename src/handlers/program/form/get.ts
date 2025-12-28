import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { Form, FormQuestion, Program } from '../../../db/models';
import { buildQuestionTree } from './common';

export const schema = {
  tags: ['Programs'],
  description: 'Get a form with its questions (by version or draft)',
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
              subQuestions: {
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
  },
};

export async function getProgramForm(
  request: FastifyRequest<{ Params: { program_id: string; version: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const programId = parseInt(request.params.program_id, 10);
    const versionParamRaw = request.params.version;

    if (isNaN(programId)) {
      return reply.code(400).send({ error: 'Invalid program id' });
    }

    if (versionParamRaw === undefined) {
      return reply.code(400).send({ error: 'Version path param is required' });
    }

    const program = await Program.findByPk(programId);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    let targetVersion: string | null = versionParamRaw;
    if (versionParamRaw === 'draft' || versionParamRaw === 'dev') {
      targetVersion = '';
    } else if (versionParamRaw === '' || versionParamRaw === 'current') {
      if (program.formVersion) {
        targetVersion = program.formVersion;
      } else {
        targetVersion = null; // will fetch latest
      }
    }

    let form: Form | null = null;

    if (targetVersion === '') {
      form = await Form.findOne({
        where: { programId, version: '' },
        include: [
          { model: FormQuestion, as: 'questions', order: [['order', 'ASC'], ['id', 'ASC']] },
        ],
        order: [
          [{ model: FormQuestion, as: 'questions' }, 'order', 'ASC'],
          [{ model: FormQuestion, as: 'questions' }, 'id', 'ASC'],
        ],
      });
    } else if (targetVersion === null) {
      // latest published
      form = await Form.findOne({
        where: { programId, version: { [Op.ne]: '' } },
        include: [
          { model: FormQuestion, as: 'questions', order: [['order', 'ASC'], ['id', 'ASC']] },
        ],
        order: [
          ['updatedAt', 'DESC'],
          ['id', 'DESC'],
          [{ model: FormQuestion, as: 'questions' }, 'order', 'ASC'],
          [{ model: FormQuestion, as: 'questions' }, 'id', 'ASC'],
        ],
      });
    } else {
      form = await Form.findOne({
        where: { programId, version: targetVersion },
        include: [
          { model: FormQuestion, as: 'questions', order: [['order', 'ASC'], ['id', 'ASC']] },
        ],
        order: [
          [{ model: FormQuestion, as: 'questions' }, 'order', 'ASC'],
          [{ model: FormQuestion, as: 'questions' }, 'id', 'ASC'],
        ],
      });
    }

    if (!form) {
      return reply.code(404).send({ error: 'Form not found for this program/version' });
    }

    const questions = (form.get('questions') as FormQuestion[] | undefined) || [];

    return reply.send({
      id: form.id,
      programId: form.programId,
      name: form.name,
      version: form.version,
      createdAt: form.createdAt?.getTime?.() ?? null,
      updatedAt: form.updatedAt?.getTime?.() ?? null,
      questions: buildQuestionTree(questions),
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to get program form' });
  }
}

