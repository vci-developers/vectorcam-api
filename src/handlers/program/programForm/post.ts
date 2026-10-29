import { FastifyRequest, FastifyReply } from 'fastify';
import sequelize from '../../../db/index';
import { Form, ProgramForm } from '../../../db/models';
import { defaultFormConstants } from '../form/defaultForm';
import { resolveProgramRouteForProgramForms, serializeProgramFormDefinition } from './common';

interface CreateProgramFormBody {
  name: string;
  programId?: number;
}

export const schema = {
  tags: ['Programs'],
  description: 'Create a logical program form with an empty draft version',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
    },
    required: ['program_id'],
  },
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1 },
      programId: { type: 'number' },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        programForm: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            programId: { type: 'number' },
            name: { type: 'string' },
            createdAt: { type: ['number', 'null'] },
            updatedAt: { type: ['number', 'null'] },
          },
        },
        draftForm: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            programId: { type: 'number' },
            programFormId: { type: 'number' },
            name: { type: 'string' },
            version: { type: 'string' },
          },
        },
      },
    },
  },
};

export async function createProgramForm(
  request: FastifyRequest<{ Params: { program_id: string }; Body: CreateProgramFormBody }>,
  reply: FastifyReply
): Promise<void> {
  const transaction = await sequelize.transaction();

  try {
    const routeContext = await resolveProgramRouteForProgramForms(
      request,
      reply,
      request.params.program_id,
      request.body.programId
    );
    if (!routeContext) {
      await transaction.rollback();
      return;
    }

    const { programId } = routeContext;
    const name = request.body.name.trim();
    if (!name) {
      await transaction.rollback();
      return reply.code(400).send({ error: 'name is required' });
    }

    const programForm = await ProgramForm.create(
      { programId, name },
      { transaction }
    );

    const draftForm = await Form.create(
      {
        programId,
        programFormId: programForm.id,
        name,
        version: defaultFormConstants.DEFAULT_VERSION,
      },
      { transaction }
    );

    await transaction.commit();

    return reply.code(201).send({
      message: 'Program form created',
      programForm: serializeProgramFormDefinition(programForm),
      draftForm: {
        id: draftForm.id,
        programId: draftForm.programId,
        programFormId: draftForm.programFormId,
        name: draftForm.name,
        version: draftForm.version,
      },
    });
  } catch (error) {
    await transaction.rollback();
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to create program form' });
  }
}
