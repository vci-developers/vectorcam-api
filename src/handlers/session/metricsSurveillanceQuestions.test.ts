import { resolveSurveillanceQuestionMappings } from './metricsSurveillanceQuestions';

const program8DefaultFormQuestions = [
  {
    id: 1,
    label: 'Number of people who slept in the house',
    type: 'number',
    questionKey: 'number_of_people_who_slept_in_the_house',
  },
  {
    id: 4,
    label: 'Number of LLINs available',
    type: 'number',
    questionKey: 'number_of_llins_available',
  },
  {
    id: 7,
    label: 'Number of people who slept under LLIN',
    type: 'number',
    questionKey: 'number_of_people_who_slept_under_llin',
  },
];

const program9LegacyNetKeys = [
  {
    id: 102,
    label: 'Number of people who slept under net last night',
    type: 'number',
    questionKey: 'number_of_people_who_slept_under_net_last_night',
  },
  {
    id: 103,
    label: 'Number of people who did not sleep under net last night',
    type: 'number',
    questionKey: 'number_of_people_who_did_not_sleep_under_net_las',
  },
  {
    id: 101,
    label: 'Number of mosquito nets in the house',
    type: 'number',
    questionKey: 'number_of_mosquito_nets_in_the_house',
  },
];

const program9NetsKeys = [
  {
    id: 201,
    label: 'Number of people who slept in the house',
    type: 'number',
    questionKey: 'number_of_people_who_slept_in_the_house',
  },
  {
    id: 202,
    label: 'Number of people who slept under nets last night',
    type: 'number',
    questionKey: 'number_of_people_who_slept_under_nets_last_night',
  },
  {
    id: 203,
    label: 'Number of people who did not sleep under nets last night',
    type: 'number',
    questionKey: 'number_of_people_who_did_not_sleep_under_nets_la',
  },
  {
    id: 101,
    label: 'Number of mosquito nets in the house',
    type: 'number',
    questionKey: 'number_of_mosquito_nets_in_the_house',
  },
];

describe('resolveSurveillanceQuestionMappings', () => {
  it('resolves legacy default form by preset question keys', () => {
    const mappings = resolveSurveillanceQuestionMappings(program8DefaultFormQuestions);

    expect(mappings.numPeopleSleptInHouse).toEqual({
      kind: 'single',
      questionKeys: ['number_of_people_who_slept_in_the_house'],
    });
    expect(mappings.numLlinsAvailable).toEqual({
      kind: 'single',
      questionKeys: ['number_of_llins_available'],
    });
    expect(mappings.numPeopleSleptUnderLlin).toEqual({
      kind: 'single',
      questionKeys: ['number_of_people_who_slept_under_llin'],
    });
  });

  it('resolves older program 9 forms with net (singular) keys via sum', () => {
    const mappings = resolveSurveillanceQuestionMappings(program9LegacyNetKeys);

    expect(mappings.numLlinsAvailable).toEqual({
      kind: 'single',
      questionKeys: ['number_of_mosquito_nets_in_the_house'],
    });
    expect(mappings.numPeopleSleptUnderLlin).toEqual({
      kind: 'single',
      questionKeys: [
        'number_of_people_who_slept_under_net_last_night',
        'number_of_people_who_slept_under_nets_last_night',
      ],
    });
    expect(mappings.numPeopleSleptInHouse).toEqual({
      kind: 'sum',
      parts: [
        [
          'number_of_people_who_slept_under_net_last_night',
          'number_of_people_who_slept_under_nets_last_night',
        ],
        [
          'number_of_people_who_did_not_sleep_under_net_las',
          'number_of_people_who_did_not_sleep_under_nets_la',
        ],
      ],
    });
  });

  it('prefers single people-in-house when present and accepts nets alias keys', () => {
    const mappings = resolveSurveillanceQuestionMappings(program9NetsKeys);

    expect(mappings.numPeopleSleptInHouse).toEqual({
      kind: 'single',
      questionKeys: ['number_of_people_who_slept_in_the_house'],
    });
    expect(mappings.numPeopleSleptUnderLlin).toEqual({
      kind: 'single',
      questionKeys: [
        'number_of_people_who_slept_under_net_last_night',
        'number_of_people_who_slept_under_nets_last_night',
      ],
    });
  });
});
