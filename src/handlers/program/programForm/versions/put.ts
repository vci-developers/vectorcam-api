import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../../../db/index';
import {
  findDraftFormVersion,
  resolveProgramFormRouteContext,
} from '../common';
import { syncProgramFormName } from '../../form/common';

interface UpdateDraftBody {
  name?: string;
}

export const schema = {
  tags: ['Programs'],
  description: 'Update draft form metadata for a logical program form',
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

export async function updateProgramFormDraftVersion(
  request: FastifyRequest<{
    Params: { program_id: string; program_form_id: string };
    Body: UpdateDraftBody;
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const context = await resolveProgramFormRouteContext(request, reply, request.params);
    if (!context) {
      return;
    }

    const form = await findDraftFormVersion(context.programFormId);
    if (!form) {
      return reply.code(404).send({ error: 'Draft form not found for this program form' });
    }

    const updates: Record<string, string> = {};
    if (request.body.name !== undefined) {
      updates.name = request.body.name;
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: 'No updates provided' });
    }

    await sequelize.transaction(async (transaction) => {
      await form.update(updates, { transaction });
      if (updates.name !== undefined) {
        await syncProgramFormName(form.programFormId, updates.name, transaction);
      }
    });

    return reply.send({
      message: 'Form updated successfully',
      form: {
        id: form.id,
        programId: form.programId,
        programFormId: form.programFormId,
        name: form.name,
        version: form.version,
        createdAt: form.createdAt?.getTime?.() ?? null,
        updatedAt: form.updatedAt?.getTime?.() ?? null,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to update draft form' });
  }
}
