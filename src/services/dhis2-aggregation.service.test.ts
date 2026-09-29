import { classifyFemaleAbdomenStatusForDhis2 } from './dhis2-aggregation.service';

describe('classifyFemaleAbdomenStatusForDhis2', () => {
  it('classifies unfed without matching fed', () => {
    expect(classifyFemaleAbdomenStatusForDhis2('Unfed')).toBe('unfed');
    expect(classifyFemaleAbdomenStatusForDhis2('unfed')).toBe('unfed');
  });

  it('classifies fully fed', () => {
    expect(classifyFemaleAbdomenStatusForDhis2('Fully fed')).toBe('fed');
    expect(classifyFemaleAbdomenStatusForDhis2('Fully Fed')).toBe('fed');
  });

  it('classifies gravid and half gravid', () => {
    expect(classifyFemaleAbdomenStatusForDhis2('Gravid')).toBe('gravid');
    expect(classifyFemaleAbdomenStatusForDhis2('Half gravid')).toBe('half_gravid');
  });

  it('returns null for empty or unknown status', () => {
    expect(classifyFemaleAbdomenStatusForDhis2('')).toBeNull();
    expect(classifyFemaleAbdomenStatusForDhis2('unknown')).toBeNull();
  });
});
