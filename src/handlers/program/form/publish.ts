import { FastifyRequest, FastifyReply } from 'fastify';
import { Op } from 'sequelize';
import sequelize from '../../../db/index';
import { Form } from '../../../db/models';
import { cloneQuestionsToForm } from './common';

interface PublishBody {
  version: string;
}

export const schema = {
  tags: ['Programs'],
  description: 'Publish a draft form with a version string',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
    },
    required: ['program_id'],
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

export async function publishProgramForm(
  request: FastifyRequest<{ Params: { program_id: string }; Body: PublishBody }>,
  reply: FastifyReply
): Promise<void> {
  const transaction = await sequelize.transaction();

  try {
    const programId = parseInt(request.params.program_id, 10);
    const { version } = request.body;

    if (isNaN(programId)) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Invalid program id' });
    }

    if (!version || version.trim() === '') {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Version is required to publish' });
    }

    const draft = await Form.findOne({ where: { programId, version: '' }, transaction });
    if (!draft) {
      await transaction.rollback();
      return reply.code(404).send({ error: 'Draft form not found for this program' });
    }

    if (draft.version !== '') {
      await transaction.rollback();
      return reply.code(400).send({ error: 'Only draft forms can be published' });
    }

    const duplicate = await Form.findOne({
      where: {
        programId,
        name: draft.name,
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
        programId,
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

