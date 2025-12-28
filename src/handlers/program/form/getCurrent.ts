import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import { Form, FormQuestion, Program } from '../../../db/models';
import { buildQuestionTree } from './common';

export const schema = {
  tags: ['Programs'],
  description: 'Get the current form (program pointer or latest published)',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
    },
    required: ['program_id'],
  },
};

export async function getProgramFormCurrent(
  request: FastifyRequest<{ Params: { program_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const programId = parseInt(request.params.program_id, 10);
    if (isNaN(programId)) {
      return reply.code(400).send({ error: 'Invalid program id' });
    }

    const program = await Program.findByPk(programId);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    let form: Form | null = null;
    if (program.formVersion) {
      form = await Form.findOne({
        where: { programId, version: program.formVersion },
        include: [{ model: FormQuestion, as: 'questions', order: [['order', 'ASC'], ['id', 'ASC']] }],
        order: [
          [{ model: FormQuestion, as: 'questions' }, 'order', 'ASC'],
          [{ model: FormQuestion, as: 'questions' }, 'id', 'ASC'],
        ],
      });
      if (!form || form.version === '') {
        return reply.code(400).send({ error: 'Program formVersion pointer is invalid or points to draft' });
      }
    } else {
      form = await Form.findOne({
        where: { programId, version: { [Op.ne]: '' } },
        include: [{ model: FormQuestion, as: 'questions', order: [['order', 'ASC'], ['id', 'ASC']] }],
        order: [
          ['updatedAt', 'DESC'],
          ['id', 'DESC'],
          [{ model: FormQuestion, as: 'questions' }, 'order', 'ASC'],
          [{ model: FormQuestion, as: 'questions' }, 'id', 'ASC'],
        ],
      });
    }

    if (!form) {
      return reply.code(404).send({ error: 'No published form found for this program' });
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
    return reply.code(500).send({ error: 'Failed to get current form' });
  }
}

