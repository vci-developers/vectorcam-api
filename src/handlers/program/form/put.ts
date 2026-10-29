import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../../db/index';
import { Form } from '../../../db/models';
import { defaultProgramFormWhere, loadProgramFormScope, syncProgramFormName } from './common';

interface UpdateFormBody {
  name?: string;
}

export const schema = {
  tags: ['Programs'],
  description: 'Update form metadata (draft only, version not updatable)',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
    },
    required: ['program_id'],
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
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

export async function updateProgramForm(
  request: FastifyRequest<{ Params: { program_id: string }; Body: UpdateFormBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const programId = parseInt(request.params.program_id, 10);

    if (isNaN(programId)) {
      return reply.code(400).send({ error: 'Invalid program id' });
    }

    const scope = await loadProgramFormScope(programId);
    if (!scope) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const form = await Form.findOne({
      where: defaultProgramFormWhere(scope.programId, scope.defaultProgramFormId, { version: '' }),
    });
    if (!form) {
      return reply.code(404).send({ error: 'Draft form not found for this program' });
    }

    if (form.version !== '') {
      return reply.code(400).send({ error: 'Only draft forms can be updated' });
    }

    const updates: Record<string, any> = {};

    if (request.body.name !== undefined) {
      updates.name = request.body.name;
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No updates provided' });
    }

    const transaction = await sequelize.transaction();
    try {
      await form.update(updates, { transaction });
      if (updates.name !== undefined) {
        await syncProgramFormName(form.programFormId, updates.name, transaction);
      }
      await transaction.commit();
    } catch (updateError) {
      await transaction.rollback();
      throw updateError;
    }

    return reply.send({
      message: 'Form updated successfully',
      form: {
        id: form.id,
        programId: form.programId,
        name: form.name,
        version: form.version,
        createdAt: form.createdAt?.getTime?.() ?? null,
        updatedAt: form.updatedAt?.getTime?.() ?? null,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to update program form' });
  }
}

