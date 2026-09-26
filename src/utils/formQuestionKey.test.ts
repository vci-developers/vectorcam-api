import {
  allocateQuestionKeyInForm,
  questionMatchSignature,
  slugifyLabelForQuestionKey,
} from './formQuestionKey';

describe('slugifyLabelForQuestionKey', () => {
  it('normalizes labels to snake_case slugs', () => {
    expect(slugifyLabelForQuestionKey('Number of people who slept in the house')).toBe(
      'number_of_people_who_slept_in_the_house'
    );
    expect(slugifyLabelForQuestionKey('  Was IRS conducted?  ')).toBe('was_irs_conducted');
  });

  it('truncates very long labels', () => {
    const longLabel = 'a'.repeat(80);
    expect(slugifyLabelForQuestionKey(longLabel).length).toBeLessThanOrEqual(48);
  });
});

describe('questionMatchSignature', () => {
  it('includes parent key context', () => {
    const root = questionMatchSignature(null, 'Child label', 'text');
    const underParent = questionMatchSignature('parent_key', 'Child label', 'text');
    expect(root).not.toEqual(underParent);
  });
});

describe('allocateQuestionKeyInForm', () => {
  it('adds numeric suffixes for collisions within a form', () => {
    const keys = new Set<string>();
    expect(allocateQuestionKeyInForm('Household size', keys)).toBe('household_size');
    expect(allocateQuestionKeyInForm('Household size', keys)).toBe('household_size_2');
  });
});
