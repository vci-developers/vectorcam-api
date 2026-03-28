import { Transaction } from 'sequelize';
import { Form } from '../../../db/models';
import FormQuestion from '../../../db/models/FormQuestion';

export interface FormQuestionInput {
  label: string;
  type: string;
  required?: boolean;
  options?: unknown[] | null;
  order?: number | null;
  parentId?: number | null;
  prerequisite?: unknown | null;
  children?: FormQuestionInput[];
}

const questionDefinitionSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    formId: { type: 'number' },
    parentId: { type: ['number', 'null'] },
    prerequisite: {},
    label: { type: 'string' },
    type: { type: 'string' },
    required: { type: 'boolean' },
    options: { type: ['array', 'null'] },
    order: { type: ['number', 'null'] },
    createdAt: { type: ['number', 'null'] },
    updatedAt: { type: ['number', 'null'] },
    subQuestions: {
      type: 'array',
      items: { $ref: '#/definitions/question' },
    },
  },
};

export const questionResponseSchema = { $ref: '#/definitions/question' };

export const programFormResponseSchema = {
  type: 'object',
  definitions: {
    question: questionDefinitionSchema,
  },
  properties: {
    id: { type: 'number' },
    programId: { type: 'number' },
    name: { type: 'string' },
    version: { type: 'string' },
    createdAt: { type: ['number', 'null'] },
    updatedAt: { type: ['number', 'null'] },
    questions: {
      type: 'array',
      items: { $ref: '#/definitions/question' },
    },
  },
};

export function serializeQuestion(question: FormQuestion): any {
  return {
    id: question.id,
    formId: question.formId,
    parentId: question.parentId,
    prerequisite: question.prerequisite ?? null,
    label: question.label,
    type: question.type,
    required: question.required,
    options: question.options,
    order: question.order,
    createdAt: question.createdAt?.getTime?.() ?? null,
    updatedAt: question.updatedAt?.getTime?.() ?? null,
  };
}

export function buildQuestionTree(questions: FormQuestion[]): any[] {
  const byParent = new Map<number | null, FormQuestion[]>();
  for (const q of questions) {
    const key = q.parentId ?? null;
    if (!byParent.has(key)) {
      byParent.set(key, []);
    }
    byParent.get(key)!.push(q);
  }

  const attach = (parentId: number | null): any[] => {
    const siblings = byParent.get(parentId) || [];
    return siblings.map(q => {
      const serialized = serializeQuestion(q);
      const children = attach(q.id);
      if (children.length > 0) {
        serialized.subQuestions = children;
      }
      return serialized;
    });
  };

  return attach(null);
}

export function serializeFormResponse(form: Form, questions: FormQuestion[]): any {
  return {
    id: form.id,
    programId: form.programId,
    name: form.name,
    version: form.version,
    createdAt: form.createdAt?.getTime?.() ?? null,
    updatedAt: form.updatedAt?.getTime?.() ?? null,
    questions: buildQuestionTree(questions),
  };
}

export async function createQuestionTree(
  formId: number,
  questions: FormQuestionInput[],
  transaction: Transaction,
  parentId: number | null = null
): Promise<FormQuestion[]> {
  const created: FormQuestion[] = [];

  for (let index = 0; index < questions.length; index++) {
    const input = questions[index];
    const question = await FormQuestion.create(
      {
        formId,
        parentId: input.parentId ?? parentId,
        prerequisite: input.prerequisite ?? null,
        label: input.label,
        type: input.type,
        required: input.required ?? false,
        options: input.options ?? null,
        order: input.order ?? index,
      },
      { transaction }
    );

    created.push(question);

    if (input.children && input.children.length > 0) {
      const children = await createQuestionTree(formId, input.children, transaction, question.id);
      created.push(...children);
    }
  }

  return created;
}

export async function cloneQuestionsToForm(
  sourceFormId: number,
  targetFormId: number,
  transaction: Transaction
): Promise<FormQuestion[]> {
  const questions = await FormQuestion.findAll({
    where: { formId: sourceFormId },
    order: [
      ['parentId', 'ASC'],
      ['order', 'ASC'],
      ['id', 'ASC'],
    ],
    transaction,
  });

  const childrenMap = new Map<number | null, FormQuestion[]>();
  for (const q of questions) {
    const parentKey = q.parentId ?? null;
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, []);
    }
    childrenMap.get(parentKey)!.push(q);
  }

  const created: FormQuestion[] = [];
  const idMap = new Map<number, number>();

  async function cloneBranch(parentId: number | null, newParentId: number | null): Promise<void> {
    const siblings = childrenMap.get(parentId) || [];
    for (const q of siblings) {
      const newQuestion = await FormQuestion.create(
        {
          formId: targetFormId,
          parentId: newParentId,
          prerequisite: q.prerequisite ?? null,
          label: q.label,
          type: q.type,
          required: q.required,
          options: q.options,
          order: q.order,
        },
        { transaction }
      );

      created.push(newQuestion);
      idMap.set(q.id, newQuestion.id);
      await cloneBranch(q.id, newQuestion.id);
    }
  }

  await cloneBranch(null, null);
  return created;
}

