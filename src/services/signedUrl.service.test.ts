import {
  buildSignedUrl,
  parseExportPath,
  signExportUrl,
  verifySignedExportUrl,
} from './signedUrl.service';

jest.mock('../config/environment', () => ({
  config: {
    signedUrl: {
      secret: 'test-secret',
      expiresInSeconds: 300,
    },
    server: {
      domain: 'http://localhost:8080',
    },
  },
}));

describe('signedUrl.service', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-13T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('parses export paths with query params', () => {
    expect(parseExportPath('/sessions/export/csv?startDate=1&endDate=2')).toEqual({
      pathname: '/sessions/export/csv',
      query: {
        startDate: '1',
        endDate: '2',
      },
    });
  });

  it('signs and verifies export URLs with only a signature query param', () => {
    const signed = signExportUrl('/sessions/export/csv', { startDate: '1', endDate: '2' });
    const url = buildSignedUrl(signed.pathname, signed.query, signed.signature);

    expect(url).toContain('signature=');
    expect(url).not.toContain('expires=');

    const parsed = new URL(url, 'http://localhost');
    const query = Object.fromEntries(parsed.searchParams.entries());

    expect(verifySignedExportUrl('/sessions/export/csv', query)).toBe(true);
    expect(verifySignedExportUrl('/sessions/export/csv', { ...query, startDate: '999' })).toBe(false);
  });

  it('rejects expired signatures', () => {
    const signed = signExportUrl('/annotations/export', {});
    const query = {
      signature: signed.signature,
    };

    jest.setSystemTime(new Date('2026-06-13T12:10:00.000Z'));
    expect(verifySignedExportUrl('/annotations/export', query)).toBe(false);
  });
});
