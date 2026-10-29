import { formAnswerJoins, numericAnswerSqlByKeys } from './getMetrics';

describe('household metric answer pick', () => {
  it('uses the largest numeric answer when a question key matches more than once', () => {
    const replacements: Record<string, string> = {};
    const sql = numericAnswerSqlByKeys(
      ['number_of_people_who_slept_in_the_house'],
      'num_people_slept_in_house',
      replacements
    );

    expect(sql).toContain('MAX(CASE');
    expect(sql).toContain('fq.question_key IN (:num_people_slept_in_house_0)');
    expect(sql).toContain('CAST(JSON_UNQUOTE(fa.value) AS DECIMAL(20, 4))');
    expect(replacements.num_people_slept_in_house_0).toBe('number_of_people_who_slept_in_the_house');
  });

  it('joins every form in the program and only questions on that form', () => {
    const joins = formAnswerJoins();

    expect(joins).toContain('f.program_id = :programId');
    expect(joins).toContain('fq.form_id = f.id');
    expect(joins).not.toContain('f.program_form_id = :defaultProgramFormId');
  });
});
