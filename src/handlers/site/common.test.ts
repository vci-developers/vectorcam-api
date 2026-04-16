import { expandSiteIdsWithDescendants, formatSiteResponse, rebuildLocationHierarchy } from './common';
import { Site } from '../../db/models';

jest.mock('../../db/models', () => ({
  Site: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
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

  it('expands descendants via the JSON siteIds field and keeps root ids', async () => {
    const findAllMock = Site.findAll as jest.Mock;

    findAllMock.mockResolvedValueOnce([
      { id: 1 },
      { id: 2 },
      { id: 4 },
    ]);

    const result = await expandSiteIdsWithDescendants([1]);

    expect(new Set(result)).toEqual(new Set([1, 2, 4]));
    expect(findAllMock).toHaveBeenCalledTimes(1);
  });

  it('always preserves root ids even if the site row is missing', async () => {
    const findAllMock = Site.findAll as jest.Mock;

    findAllMock.mockResolvedValueOnce([{ id: 2 }]);

    const result = await expandSiteIdsWithDescendants([1]);

    expect(result).toEqual(expect.arrayContaining([1, 2]));
    expect(findAllMock).toHaveBeenCalledTimes(1);
  });

  it('returns empty for empty input without querying', async () => {
    const findAllMock = Site.findAll as jest.Mock;

    const result = await expandSiteIdsWithDescendants([]);

    expect(result).toEqual([]);
    expect(findAllMock).not.toHaveBeenCalled();
  });
});

function buildMockSite(params: {
  id: number;
  name: string;
  locationTypeId: number;
  locationTypeName: string;
  parent?: any;
}) {
  const { id, name, locationTypeId, locationTypeName, parent } = params;
  return {
    id,
    programId: 1,
    isActive: true,
    hasData: false,
    name,
    locationTypeId,
    parentId: parent?.id ?? null,
    locationHierarchy: null,
    get: (key: string) => {
      if (key === 'locationType') return { id: locationTypeId, name: locationTypeName };
      if (key === 'parent') return parent ?? null;
      return undefined;
    },
  } as unknown as Site;
}

describe('formatSiteResponse location hierarchy rebuild', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes the current site in locationHierarchy', async () => {
    const district = buildMockSite({
      id: 1,
      name: 'Kampala',
      locationTypeId: 11,
      locationTypeName: 'district',
    });

    const response = await formatSiteResponse(district);

    expect(response.locationHierarchy).toEqual({
      district: 'Kampala',
    });
  });

  it('builds locationHierarchy in root-to-leaf key order', async () => {
    const district = buildMockSite({
      id: 1,
      name: 'Kampala',
      locationTypeId: 11,
      locationTypeName: 'district',
    });
    const subCounty = buildMockSite({
      id: 2,
      name: 'Makindye',
      locationTypeId: 12,
      locationTypeName: 'subCounty',
      parent: district,
    });
    const village = buildMockSite({
      id: 3,
      name: 'Nsambya',
      locationTypeId: 13,
      locationTypeName: 'village',
      parent: subCounty,
    });

    const response = await formatSiteResponse(village);

    expect(Object.keys(response.locationHierarchy || {})).toEqual(['district', 'subCounty', 'village']);
    expect(response.locationHierarchy).toEqual({
      district: 'Kampala',
      subCounty: 'Makindye',
      village: 'Nsambya',
    });
  });

  it('formats structured hierarchy object from storage into key/value map response', async () => {
    const siteWithStructuredHierarchy = {
      ...buildMockSite({
        id: 100,
        name: 'Leaf',
        locationTypeId: 13,
        locationTypeName: 'village',
      }),
      locationHierarchy: {
        hierarchy: [
          { locationType: 'district', value: 'Kampala' },
          { locationType: 'subCounty', value: 'Makindye' },
          { locationType: 'village', value: 'Nsambya' },
        ],
        siteIds: [1, 2, 100],
      },
    } as unknown as Site;

    const response = await formatSiteResponse(siteWithStructuredHierarchy);

    expect(response.locationHierarchy).toEqual({
      district: 'Kampala',
      subCounty: 'Makindye',
      village: 'Nsambya',
    });
  });
});

describe('rebuildLocationHierarchy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hydrates root site so root location type/name is included', async () => {
    const findByPkMock = Site.findByPk as jest.Mock;
    const findAllMock = Site.findAll as jest.Mock;

    const hydratedRootSite = buildMockSite({
      id: 10,
      name: 'Kampala',
      locationTypeId: 11,
      locationTypeName: 'district',
    });
    hydratedRootSite.update = jest.fn().mockResolvedValue(hydratedRootSite);

    findByPkMock
      .mockResolvedValueOnce(hydratedRootSite)
      .mockResolvedValueOnce(hydratedRootSite);
    findAllMock.mockResolvedValueOnce([]);

    const partialRootSite = {
      id: 10,
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as Site;

    await rebuildLocationHierarchy(partialRootSite);

    expect(hydratedRootSite.update).toHaveBeenCalledWith({
      locationHierarchy: {
        hierarchy: [{ locationType: 'district', value: 'Kampala' }],
        siteIds: [10],
      },
    });
  });
});
