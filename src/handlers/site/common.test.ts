import { expandSiteIdsWithDescendants } from './common';
import { Site } from '../../db/models';

jest.mock('../../db/models', () => ({
  Site: {
    findAll: jest.fn(),
  },
  Program: {},
  Session: {},
  LocationType: {
    findByPk: jest.fn(),
  },
}));

describe('expandSiteIdsWithDescendants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('expands descendants and keeps root ids while filtering by hasData', async () => {
    const findAllMock = Site.findAll as jest.Mock;

    findAllMock
      .mockResolvedValueOnce([{ id: 2 }, { id: 3 }])
      .mockResolvedValueOnce([{ id: 4 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 1, hasData: false },
        { id: 2, hasData: true },
        { id: 3, hasData: false },
        { id: 4, hasData: true },
      ]);

    const result = await expandSiteIdsWithDescendants([1]);

    expect(new Set(result)).toEqual(new Set([1, 2, 4]));
  });

  it('returns full expanded ids when hasData filter is disabled', async () => {
    const findAllMock = Site.findAll as jest.Mock;

    findAllMock
      .mockResolvedValueOnce([{ id: 2 }])
      .mockResolvedValueOnce([]);

    const result = await expandSiteIdsWithDescendants([1], { includeHasDataOnly: false });

    expect(result).toEqual(expect.arrayContaining([1, 2]));
    expect(findAllMock).toHaveBeenCalledTimes(2);
  });

  it('returns empty for empty input without querying', async () => {
    const findAllMock = Site.findAll as jest.Mock;

    const result = await expandSiteIdsWithDescendants([]);

    expect(result).toEqual([]);
    expect(findAllMock).not.toHaveBeenCalled();
  });
});
