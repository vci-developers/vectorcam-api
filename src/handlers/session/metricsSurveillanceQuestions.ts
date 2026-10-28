export type SurveillanceMetricField =
  | 'numPeopleSleptInHouse'
  | 'numLlinsAvailable'
  | 'numPeopleSleptUnderLlin';

export interface FormQuestionLike {
  id: number;
  label: string;
  type: string;
  questionKey: string;
}

export type SurveillanceQuestionMapping =
  | { kind: 'single'; questionId: number; questionKey: string }
  | { kind: 'sum'; questionIds: number[]; questionKeys: string[] };

export type SurveillanceQuestionMappings = Partial<
  Record<SurveillanceMetricField, SurveillanceQuestionMapping>
>;

/**
 * Preset question keys for each surveillance metric column.
 * Resolution picks the first single-key match on the form, otherwise the first
 * sum-key group where every key exists on the form (test DB / vectorcam_test).
 */
export const PRESET_SURVEILLANCE_QUESTION_KEYS: Record<
  SurveillanceMetricField,
  { single?: readonly string[]; sum?: readonly (readonly string[])[] }
> = {
  numPeopleSleptInHouse: {
    single: ['number_of_people_who_slept_in_the_house'],
    sum: [
      [
        'number_of_people_who_slept_under_net_last_night',
        'number_of_people_who_did_not_sleep_under_net_las',
      ],
    ],
  },
  numLlinsAvailable: {
    single: ['number_of_llins_available', 'number_of_mosquito_nets_in_the_house'],
  },
  numPeopleSleptUnderLlin: {
    single: [
      'number_of_people_who_slept_under_llin',
      'number_of_people_who_slept_under_net_last_night',
    ],
  },
};

function indexQuestionsByKey(
  questions: FormQuestionLike[]
): Map<string, FormQuestionLike> {
  const byKey = new Map<string, FormQuestionLike>();
  for (const question of questions) {
    byKey.set(question.questionKey, question);
  }
  return byKey;
}

function resolveFieldMapping(
  field: SurveillanceMetricField,
  byKey: Map<string, FormQuestionLike>
): SurveillanceQuestionMapping | undefined {
  const preset = PRESET_SURVEILLANCE_QUESTION_KEYS[field];

  for (const key of preset.single ?? []) {
    const question = byKey.get(key);
    if (question) {
      return {
        kind: 'single',
        questionId: question.id,
        questionKey: question.questionKey,
      };
    }
  }

  for (const keyGroup of preset.sum ?? []) {
    const resolved = keyGroup.map((key) => byKey.get(key));
    if (resolved.every((question): question is FormQuestionLike => question !== undefined)) {
      return {
        kind: 'sum',
        questionIds: resolved.map((question) => question.id),
        questionKeys: keyGroup.slice(),
      };
    }
  }

  return undefined;
}

/**
 * Map surveillance-form metric columns to form questions using preset question keys.
 */
export function resolveSurveillanceQuestionMappings(
  questions: FormQuestionLike[]
): SurveillanceQuestionMappings {
  const byKey = indexQuestionsByKey(questions);
  const mappings: SurveillanceQuestionMappings = {};

  for (const field of [
    'numPeopleSleptInHouse',
    'numLlinsAvailable',
    'numPeopleSleptUnderLlin',
  ] as const) {
    const mapping = resolveFieldMapping(field, byKey);
    if (mapping) {
      mappings[field] = mapping;
    }
  }

  return mappings;
}

export function hasRequiredSurveillanceMappings(
  mappings: SurveillanceQuestionMappings
): boolean {
  return Boolean(
    mappings.numPeopleSleptInHouse
      && mappings.numLlinsAvailable
      && mappings.numPeopleSleptUnderLlin
  );
}
