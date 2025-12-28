import { Transaction } from 'sequelize';
import FormQuestion from '../../../db/models/FormQuestion';

export interface FormQuestionInput {
  label: string;
  type: string;
  required?: boolean;
  options?: unknown[] | null;
  order?: number | null;
  parentId?: number | null;
  children?: FormQuestionInput[];
}

export function serializeQuestion(question: FormQuestion): any {
  return {
    id: question.id,
    formId: question.formId,
    parentId: question.parentId,
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

