import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../../../db/index';
import { FormQuestion } from '../../../../db/models';
import { findDraftFormVersion, resolveProgramFormRouteContext } from '../common';

export const schema = {
  tags: ['Programs'],
  description: 'Delete a question from a logical program form draft',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      program_form_id: { type: 'string' },
      question_id: { type: 'string' },
    },
    required: ['program_id', 'program_form_id', 'question_id'],
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

export async function deleteProgramFormDefinitionQuestion(
  request: FastifyRequest<{
    Params: { program_id: string; program_form_id: string; question_id: string };
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

    await question.destroy({ transaction });
    await transaction.commit();

    return reply.send({ message: 'Question deleted' });
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to delete question' });
  }
}
