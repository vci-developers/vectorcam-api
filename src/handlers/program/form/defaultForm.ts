import { Transaction } from 'sequelize';
import { Form, FormQuestion } from '../../../db/models';

const DEFAULT_FORM_NAME = 'Default Surveillance Form';
const DEFAULT_VERSION = '';

const defaultQuestions = [
  {
    label: 'Number of people who slept in the house',
    type: 'number',
    required: true,
    order: 1,
  },
  {
    label: 'Was IRS conducted?',
    type: 'boolean',
    required: false,
    order: 2,
  },
  {
    label: 'Months since IRS',
    type: 'number',
    required: false,
    order: 3,
  },
  {
    label: 'Number of LLINs available',
    type: 'number',
    required: false,
    order: 4,
  },
  {
    label: 'LLIN type',
    type: 'select',
    required: false,
    order: 5,
    options: [
      'Pyrethroid-only',
      'Pyrethroid + PBO',
      'Pyrethroid + chlorfenapyr',
      'Pyrethroid + pyriproxyfen',
      'Other',
    ],
  },
  {
    label: 'LLIN brand',
    type: 'text',
    required: false,
    order: 6,
  },
  {
    label: 'Number of people who slept under LLIN',
    type: 'number',
    required: false,
    order: 7,
  },
];

export async function createDefaultFormForProgram(
  programId: number,
  transaction: Transaction
): Promise<Form> {
  const form = await Form.create(
    {
      programId,
      name: DEFAULT_FORM_NAME,
      version: DEFAULT_VERSION,
    },
    { transaction }
  );

  await FormQuestion.bulkCreate(
    defaultQuestions.map((q, idx) => ({
      formId: form.id,
      parentId: null,
      label: q.label,
      type: q.type,
      required: q.required ?? false,
      options: q.options ?? null,
      order: q.order ?? idx + 1,
    })),
    { transaction }
  );

  return form;
}

export const defaultFormConstants = {
  DEFAULT_FORM_NAME,
  DEFAULT_VERSION,
};

