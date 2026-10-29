import { FastifyReply, FastifyRequest } from 'fastify';
import { Op, Transaction } from 'sequelize';
import { Form, FormQuestion, Program, ProgramForm } from '../../../db/models';
import { serializeFormResponse } from '../form/common';

export const programFormDefinitionSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    programId: { type: 'number' },
    name: { type: 'string' },
    createdAt: { type: ['number', 'null'] },
    updatedAt: { type: ['number', 'null'] },
  },
};

export const programFormVersionSummarySchema = {
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
};

export function serializeProgramFormDefinition(programForm: ProgramForm): Record<string, unknown> {
  return {
    id: programForm.id,
    programId: programForm.programId,
    name: programForm.name,
    createdAt: programForm.createdAt?.getTime?.() ?? null,
    updatedAt: programForm.updatedAt?.getTime?.() ?? null,
  };
}

export function enforceUserProgramScope(
  request: FastifyRequest,
  reply: FastifyReply,
  programId: number
): boolean {
  if (request.authType !== 'user' || !request.user) {
    return true;
  }

  if (request.user.isDeveloper) {
    return true;
  }

  if (request.user.programId == null || request.user.programId !== programId) {
    reply.code(403).send({ error: 'Forbidden: Program access denied' });
    return false;
  }

  return true;
}

export interface ProgramFormRouteContext {
  programId: number;
  programFormId: number;
  programForm: ProgramForm;
}

export async function resolveProgramFormRouteContext(
  request: FastifyRequest,
  reply: FastifyReply,
  params: { program_id: string; program_form_id: string }
): Promise<ProgramFormRouteContext | null> {
  const programId = parseInt(params.program_id, 10);
  const programFormId = parseInt(params.program_form_id, 10);

  if (isNaN(programId) || isNaN(programFormId)) {
    reply.code(400).send({ error: 'Invalid program id or program form id' });
    return null;
  }

  if (!enforceUserProgramScope(request, reply, programId)) {
    return null;
  }

  const program = await Program.findByPk(programId);
  if (!program) {
    reply.code(404).send({ error: 'Program not found' });
    return null;
  }

  const programForm = await ProgramForm.findOne({ where: { id: programFormId, programId } });
  if (!programForm) {
    reply.code(404).send({ error: 'Program form not found' });
    return null;
  }

  return { programId, programFormId, programForm };
}

export async function resolveProgramRouteForProgramForms(
  request: FastifyRequest,
  reply: FastifyReply,
  programIdParam: string,
  bodyProgramId?: number
): Promise<{ programId: number; program: Program } | null> {
  const programId = parseInt(programIdParam, 10);
  if (isNaN(programId)) {
    reply.code(400).send({ error: 'Invalid program id' });
    return null;
  }

  if (bodyProgramId !== undefined && bodyProgramId !== programId) {
    reply.code(400).send({ error: 'programId in body must match program_id in path' });
    return null;
  }

  if (!enforceUserProgramScope(request, reply, programId)) {
    return null;
  }

  const program = await Program.findByPk(programId);
  if (!program) {
    reply.code(404).send({ error: 'Program not found' });
    return null;
  }

  return { programId, program };
}

export async function findDraftFormVersion(
  programFormId: number,
  transaction?: Transaction
): Promise<Form | null> {
  return Form.findOne({
    where: { programFormId, version: '' },
    transaction,
  });
}

const formWithQuestionsInclude = [
  {
    model: FormQuestion,
    as: 'questions',
    order: [['order', 'ASC'], ['id', 'ASC']] as [string, string][],
  },
];

export async function fetchFormVersionWithQuestions(
  programFormId: number,
  versionParamRaw: string,
  program: Program | null
): Promise<Form | null> {
  let targetVersion: string | null = versionParamRaw;
  if (versionParamRaw === 'draft' || versionParamRaw === 'dev') {
    targetVersion = '';
  } else if (versionParamRaw === '' || versionParamRaw === 'current') {
    if (
      program
      && program.defaultProgramFormId === programFormId
      && program.formVersion
    ) {
      targetVersion = program.formVersion;
    } else {
      targetVersion = null;
    }
  }

  if (targetVersion === '') {
    return Form.findOne({
      where: { programFormId, version: '' },
      include: formWithQuestionsInclude,
      order: [
        [{ model: FormQuestion, as: 'questions' }, 'order', 'ASC'],
        [{ model: FormQuestion, as: 'questions' }, 'id', 'ASC'],
      ],
    });
  }

  if (targetVersion === null) {
    return Form.findOne({
      where: { programFormId, version: { [Op.ne]: '' } },
      include: formWithQuestionsInclude,
      order: [
        ['updatedAt', 'DESC'],
        ['id', 'DESC'],
        [{ model: FormQuestion, as: 'questions' }, 'order', 'ASC'],
        [{ model: FormQuestion, as: 'questions' }, 'id', 'ASC'],
      ],
    });
  }

  return Form.findOne({
    where: { programFormId, version: targetVersion },
    include: formWithQuestionsInclude,
    order: [
      [{ model: FormQuestion, as: 'questions' }, 'order', 'ASC'],
      [{ model: FormQuestion, as: 'questions' }, 'id', 'ASC'],
    ],
  });
}

export async function fetchCurrentPublishedFormVersion(
  programFormId: number,
  program: Program
): Promise<Form | null> {
  if (program.defaultProgramFormId === programFormId && program.formVersion) {
    const form = await Form.findOne({
      where: { programFormId, version: program.formVersion },
      include: formWithQuestionsInclude,
      order: [
        [{ model: FormQuestion, as: 'questions' }, 'order', 'ASC'],
        [{ model: FormQuestion, as: 'questions' }, 'id', 'ASC'],
      ],
    });
    if (form && form.version !== '') {
      return form;
    }
  }

  return Form.findOne({
    where: { programFormId, version: { [Op.ne]: '' } },
    include: formWithQuestionsInclude,
    order: [
      ['updatedAt', 'DESC'],
      ['id', 'DESC'],
      [{ model: FormQuestion, as: 'questions' }, 'order', 'ASC'],
      [{ model: FormQuestion, as: 'questions' }, 'id', 'ASC'],
    ],
  });
}

export function sendFormVersionResponse(
  reply: FastifyReply,
  form: Form
): void {
  const questions = (form.get('questions') as FormQuestion[] | undefined) || [];
  reply.send(serializeFormResponse(form, questions));
}
