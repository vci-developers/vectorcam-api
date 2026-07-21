import {
  buildSignedUrl,
  parseResourcePath,
  signResourceUrl,
  verifySignedResourceUrl,
} from './signedUrl.service';

jest.mock('../config/environment', () => ({
  config: {
    signedUrl: {
      secret: 'test-secret',
      expiresInSeconds: 300,
      imageExpiresInSeconds: 3600,
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

  it('parses resource paths with query params', () => {
    expect(parseResourcePath('/sessions/export/csv?startDate=1&endDate=2')).toEqual({
      pathname: '/sessions/export/csv',
      query: {
        startDate: '1',
        endDate: '2',
      },
    });
  });

  it('signs and verifies resource URLs with only a signature query param', () => {
    const signed = signResourceUrl('/sessions/export/csv', { startDate: '1', endDate: '2' });
    const url = buildSignedUrl(signed.pathname, signed.query, signed.signature);

    expect(url).toContain('signature=');
    expect(url).not.toContain('expires=');

    const parsed = new URL(url, 'http://localhost');
    const query = Object.fromEntries(parsed.searchParams.entries());

    expect(verifySignedResourceUrl('/sessions/export/csv', query)).toBe(true);
    expect(verifySignedResourceUrl('/sessions/export/csv', { ...query, startDate: '999' })).toBe(false);
  });

  it('rejects expired signatures', () => {
    const signed = signResourceUrl('/annotations/export', {});
    const query = {
      signature: signed.signature,
    };

    jest.setSystemTime(new Date('2026-06-13T12:10:00.000Z'));
    expect(verifySignedResourceUrl('/annotations/export', query)).toBe(false);
  });

  it('signs and verifies specimen image URLs with a longer expiry', () => {
    const signed = signResourceUrl('/specimens/42/images/abc-123', {});
    const url = buildSignedUrl(signed.pathname, signed.query, signed.signature);

    expect(signed.expiresAt).toBe(Math.floor(new Date('2026-06-13T12:00:00.000Z').getTime() / 1000) + 3600);

    const parsed = new URL(url, 'http://localhost');
    const query = Object.fromEntries(parsed.searchParams.entries());

    expect(verifySignedResourceUrl('/specimens/42/images/abc-123', query)).toBe(true);
    expect(verifySignedResourceUrl('/specimens/42/images/other-id', query)).toBe(false);
  });
});
