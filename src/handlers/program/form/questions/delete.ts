import { FastifyRequest, FastifyReply } from 'fastify';
import { Form, FormQuestion } from '../../../../db/models';
import sequelize from '../../../../db/index';

export const schema = {
  tags: ['Programs'],
  description: 'Delete a question from a draft form',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      question_id: { type: 'string' },
    },
    required: ['program_id', 'question_id'],
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

export async function deleteProgramFormQuestion(
  request: FastifyRequest<{ Params: { program_id: string; question_id: string } }>,
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

    await question.destroy({ transaction });
    await transaction.commit();

    return reply.send({ message: 'Question deleted' });
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to delete question' });
  }
}

