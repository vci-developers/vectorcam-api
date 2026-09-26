import { Transaction } from 'sequelize';
import FormQuestion from '../db/models/FormQuestion';

const MAX_KEY_LENGTH = 64;
const MAX_SLUG_LENGTH = 48;

/**
 * Derive a short, stable slug from a question label (snake_case, a-z0-9).
 */
export function slugifyLabelForQuestionKey(label: string): string {
  const slug = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  if (!slug) {
    return 'question';
  }

  if (slug.length <= MAX_SLUG_LENGTH) {
    return slug;
  }

  return slug.slice(0, MAX_SLUG_LENGTH).replace(/_+$/, '') || 'question';
}

/**
 * Signature used to match the same logical question across form versions within a program.
 */
export function questionMatchSignature(
  parentQuestionKey: string | null,
  label: string,
  type: string
): string {
  return `${parentQuestionKey ?? ''}\0${slugifyLabelForQuestionKey(label)}\0${type}`;
}

function truncateKey(key: string): string {
  if (key.length <= MAX_KEY_LENGTH) {
    return key;
  }
  return key.slice(0, MAX_KEY_LENGTH).replace(/_+$/, '') || 'question';
}

/**
 * Pick a questionKey unique within the given form, based on the label slug with numeric suffixes on collision.
 */
export async function generateUniqueQuestionKey(
  label: string,
  formId: number,
  transaction?: Transaction,
  reservedInForm?: Set<string>
): Promise<string> {
  const base = truncateKey(slugifyLabelForQuestionKey(label));
  let candidate = base;
  let suffix = 2;

  while (true) {
    if (reservedInForm?.has(candidate)) {
      candidate = truncateKey(`${base}_${suffix++}`);
      continue;
    }

    const existing = await FormQuestion.findOne({
      where: { formId, questionKey: candidate },
      attributes: ['id'],
      transaction,
    });

    if (!existing) {
      reservedInForm?.add(candidate);
      return candidate;
    }

    candidate = truncateKey(`${base}_${suffix++}`);
  }
}

/**
 * In-memory variant for migrations (no per-row DB lookups).
 */
export function allocateQuestionKeyInForm(
  label: string,
  keysInForm: Set<string>
): string {
  const base = truncateKey(slugifyLabelForQuestionKey(label));
  let candidate = base;
  let suffix = 2;

  while (keysInForm.has(candidate)) {
    candidate = truncateKey(`${base}_${suffix++}`);
  }

  keysInForm.add(candidate);
  return candidate;
}
