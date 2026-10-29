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

/** Each inner array is an alias group: any key in the group may appear on answers (any form version). */
export type SurveillanceQuestionMapping =
  | { kind: 'single'; questionKeys: readonly string[] }
  | { kind: 'sum'; parts: readonly (readonly string[])[] };

export type SurveillanceQuestionMappings = Partial<
  Record<SurveillanceMetricField, SurveillanceQuestionMapping>
>;

/**
 * Preset question key alias groups for each surveillance metric column.
 * Single: first alias group with any key on the program wins.
 * Sum: first sum definition where every part has at least one key on the program wins.
 */
export const PRESET_SURVEILLANCE_QUESTION_KEYS: Record<
  SurveillanceMetricField,
  { single?: readonly (readonly string[])[]; sum?: readonly (readonly (readonly string[])[])[] }
> = {
  numPeopleSleptInHouse: {
    single: [['number_of_people_who_slept_in_the_house']],
    sum: [
      [
        [
          'number_of_people_who_slept_under_net_last_night',
          'number_of_people_who_slept_under_nets_last_night',
        ],
        [
          'number_of_people_who_did_not_sleep_under_net_las',
          'number_of_people_who_did_not_sleep_under_nets_la',
        ],
      ],
    ],
  },
  numLlinsAvailable: {
    single: [
      ['number_of_llins_available'],
      ['number_of_mosquito_nets_in_the_house'],
    ],
  },
  numPeopleSleptUnderLlin: {
    single: [
      ['number_of_people_who_slept_under_llin'],
      [
        'number_of_people_who_slept_under_net_last_night',
        'number_of_people_who_slept_under_nets_last_night',
      ],
    ],
  },
};

function collectQuestionKeys(questions: FormQuestionLike[]): Set<string> {
  return new Set(questions.map((question) => question.questionKey));
}

function aliasGroupMatches(group: readonly string[], keySet: Set<string>): boolean {
  return group.some((key) => keySet.has(key));
}

function resolveFieldMapping(
  field: SurveillanceMetricField,
  keySet: Set<string>
): SurveillanceQuestionMapping | undefined {
  const preset = PRESET_SURVEILLANCE_QUESTION_KEYS[field];

  for (const group of preset.single ?? []) {
    if (aliasGroupMatches(group, keySet)) {
      return { kind: 'single', questionKeys: group };
    }
  }

  for (const sumDefinition of preset.sum ?? []) {
    if (sumDefinition.every((part) => aliasGroupMatches(part, keySet))) {
      return { kind: 'sum', parts: sumDefinition };
    }
  }

  return undefined;
}

/**
 * Map surveillance-form metric columns to preset question key alias groups for a program.
 */
export function resolveSurveillanceQuestionMappings(
  questions: FormQuestionLike[]
): SurveillanceQuestionMappings {
  const keySet = collectQuestionKeys(questions);
  const mappings: SurveillanceQuestionMappings = {};

  for (const field of [
    'numPeopleSleptInHouse',
    'numLlinsAvailable',
    'numPeopleSleptUnderLlin',
  ] as const) {
    const mapping = resolveFieldMapping(field, keySet);
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
