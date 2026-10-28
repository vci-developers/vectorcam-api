import { resolveSurveillanceQuestionMappings } from './metricsSurveillanceQuestions';

/** Snapshot of program 8 default form questions (NODE_ENV=test / vectorcam_test). */
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

/** Snapshot of program 9 v1.0.2 household net questions (NODE_ENV=test / vectorcam_test). */
const program9HouseholdQuestions = [
  {
    id: 101,
    label: 'Number of mosquito nets in the house',
    type: 'number',
    questionKey: 'number_of_mosquito_nets_in_the_house',
  },
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
];

describe('resolveSurveillanceQuestionMappings', () => {
  it('resolves legacy default form by preset question keys', () => {
    const mappings = resolveSurveillanceQuestionMappings(program8DefaultFormQuestions);

    expect(mappings.numPeopleSleptInHouse).toEqual({
      kind: 'single',
      questionId: 1,
      questionKey: 'number_of_people_who_slept_in_the_house',
    });
    expect(mappings.numLlinsAvailable).toEqual({
      kind: 'single',
      questionId: 4,
      questionKey: 'number_of_llins_available',
    });
    expect(mappings.numPeopleSleptUnderLlin).toEqual({
      kind: 'single',
      questionId: 7,
      questionKey: 'number_of_people_who_slept_under_llin',
    });
  });

  it('resolves location-hierarchy form by preset question keys', () => {
    const mappings = resolveSurveillanceQuestionMappings(program9HouseholdQuestions);

    expect(mappings.numLlinsAvailable).toEqual({
      kind: 'single',
      questionId: 101,
      questionKey: 'number_of_mosquito_nets_in_the_house',
    });
    expect(mappings.numPeopleSleptUnderLlin).toEqual({
      kind: 'single',
      questionId: 102,
      questionKey: 'number_of_people_who_slept_under_net_last_night',
    });
    expect(mappings.numPeopleSleptInHouse).toEqual({
      kind: 'sum',
      questionIds: [102, 103],
      questionKeys: [
        'number_of_people_who_slept_under_net_last_night',
        'number_of_people_who_did_not_sleep_under_net_las',
      ],
    });
  });
});
