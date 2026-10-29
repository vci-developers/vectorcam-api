import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import sequelize from '../../../../db/index';
import { Form } from '../../../../db/models';
import { cloneQuestionsToForm } from '../../form/common';
import { findDraftFormVersion, resolveProgramFormRouteContext } from '../common';

interface PublishBody {
  version: string;
}

export const schema = {
  tags: ['Programs'],
  description: 'Publish the draft form version for a logical program form',
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
    required: ['version'],
    properties: {
      version: { type: 'string' },
    },
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
            programFormId: { type: 'number' },
            name: { type: 'string' },
            version: { type: 'string' },
            createdAt: { type: ['number', 'null'] },
            updatedAt: { type: ['number', 'null'] },
          },
        },
      },
    },
  },
};

export async function publishProgramFormVersion(
  request: FastifyRequest<{
    Params: { program_id: string; program_form_id: string };
    Body: PublishBody;
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

    const { version } = request.body;
    if (!version || version.trim() === '') {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Version is required to publish' });
    }

    const draft = await findDraftFormVersion(context.programFormId, transaction);
    if (!draft) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Draft form not found for this program form' });
    }

    const duplicate = await Form.findOne({
      where: {
        programFormId: context.programFormId,
        version,
        id: { [Op.ne]: draft.id },
      },
      transaction,
    });

    if (duplicate) {
      await transaction.rollback();
      return reply.code(409).send({ error: 'A form with this version already exists' });
    }

    const published = await Form.create(
      {
        programId: context.programId,
        programFormId: context.programFormId,
        name: draft.name,
        version,
      },
      { transaction }
    );

    await cloneQuestionsToForm(draft.id, published.id, transaction);

    await transaction.commit();

    return reply.send({
      message: 'Form published successfully',
      form: {
        id: published.id,
        programId: published.programId,
        programFormId: published.programFormId,
        name: published.name,
        version: published.version,
        createdAt: published.createdAt?.getTime?.() ?? null,
        updatedAt: published.updatedAt?.getTime?.() ?? null,
      },
    });
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to publish form' });
  }
}
