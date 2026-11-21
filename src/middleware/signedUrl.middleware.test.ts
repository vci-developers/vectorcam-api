import { restrictResourceQuery } from './signedUrl.middleware';
import { AccessContext } from '../services/accessContext';
import { unrestrictedAccess } from '../test/access';

jest.mock('../db/models', () => ({
  Session: {},
  Specimen: {},
}));

jest.mock('../handlers/site/common', () => ({
  parseSiteIds: (value?: string) =>
    value ? value.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0) : [],
}));

function readerAccess(scope: 'program' | 'assigned_sites') {
  return AccessContext.forUser({
    programId: 3,
    grants: [
      { permission: 'session:read', scope },
      { permission: 'data:export', scope: 'program' },
    ],
    assignedSiteIds: [20],
    loadSiteIds: async (loadedScope) => (loadedScope === 'program' ? [20, 21, 22] : [20, 21]),
  });
}

describe('restrictResourceQuery', () => {
  it('leaves unrestricted callers alone', async () => {
    const query: Record<string, unknown> = { programId: '9' };

    await expect(restrictResourceQuery('/sessions/export/csv', query, unrestrictedAccess())).resolves.toBeNull();
    expect(query).toEqual({ programId: '9' });
  });

  it('pins exports to the caller\'s program', async () => {
    const query: Record<string, unknown> = { startDate: '2026-01-01' };

    await expect(restrictResourceQuery('/specimens/export/csv', query, readerAccess('program'))).resolves.toBeNull();
    expect(query).toEqual({ startDate: '2026-01-01', programId: '3' });
  });

  it('rejects exports for another program', async () => {
    const query: Record<string, unknown> = { programId: 4 };

    await expect(restrictResourceQuery('/annotations/export', query, readerAccess('program')))
      .resolves.toMatch(/another program/);
  });

  it('limits the session report to assigned sites for site-scoped readers', async () => {
    const query: Record<string, unknown> = {};

    await expect(restrictResourceQuery('/sessions/report', query, readerAccess('assigned_sites'))).resolves.toBeNull();
    expect(query).toEqual({ programId: '3', siteIds: '20' });
  });

  it('rejects report site filters outside the caller\'s sites', async () => {
    await expect(restrictResourceQuery('/sessions/report', { siteIds: '21' }, readerAccess('assigned_sites')))
      .resolves.toBeNull();
    await expect(restrictResourceQuery('/sessions/report', { siteIds: '22' }, readerAccess('assigned_sites')))
      .resolves.toMatch(/requested sites/);
  });

  it('does not restrict paths outside program data', async () => {
    const query: Record<string, unknown> = {};

    await expect(restrictResourceQuery('/users/auth-events/report', query, readerAccess('program'))).resolves.toBeNull();
    expect(query).toEqual({});
  });
});
