import crypto from 'crypto';
import { config } from '../config/environment';

export const EXPORT_REPORT_PATHS = [
  '/sessions/export/csv',
  '/sessions/export/surveillance-forms/csv',
  '/sessions/export/forms/csv',
  '/sessions/report',
  '/specimens/export/csv',
  '/annotations/export',
] as const;

export type ExportReportPath = (typeof EXPORT_REPORT_PATHS)[number];

export type ExportPathAuthRequirement = 'adminOrSuperAdmin' | 'siteRead' | 'annotation';

const SIGNATURE_QUERY_PARAM = 'signature';

export function isExportReportPath(pathname: string): pathname is ExportReportPath {
  return (EXPORT_REPORT_PATHS as readonly string[]).includes(pathname);
}

export function getExportPathAuthRequirement(pathname: string): ExportPathAuthRequirement | null {
  if (!isExportReportPath(pathname)) {
    return null;
  }

  if (pathname === '/sessions/report') {
    return 'siteRead';
  }

  if (pathname === '/annotations/export') {
    return 'annotation';
  }

  return 'adminOrSuperAdmin';
}

export function isSignedUrlConfigured(): boolean {
  return Boolean(config.signedUrl.secret);
}

function canonicalizeQuery(query: Record<string, unknown>): string {
  const pairs: Array<[string, string]> = [];

  for (const [key, value] of Object.entries(query)) {
    if (key === SIGNATURE_QUERY_PARAM || value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        pairs.push([key, String(item)]);
      }
      continue;
    }

    pairs.push([key, String(value)]);
  }

  pairs.sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    const keyCompare = leftKey.localeCompare(rightKey);
    if (keyCompare !== 0) {
      return keyCompare;
    }
    return leftValue.localeCompare(rightValue);
  });

  return pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function buildSigningMessage(pathname: string, query: Record<string, unknown>): string {
  const canonicalQuery = canonicalizeQuery(query);
  return canonicalQuery ? `${pathname}?${canonicalQuery}` : pathname;
}

function createSignature(
  pathname: string,
  query: Record<string, unknown>,
  expiresAt: number,
  secret: string
): string {
  const message = `${expiresAt}:${buildSigningMessage(pathname, query)}`;
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

function formatSignatureToken(expiresAt: number, hmac: string): string {
  return `${expiresAt}.${hmac}`;
}

function parseSignatureToken(token: string): { expiresAt: number; hmac: string } | null {
  const separatorIndex = token.indexOf('.');
  if (separatorIndex <= 0) {
    return null;
  }

  const expiresAt = Number.parseInt(token.slice(0, separatorIndex), 10);
  const hmac = token.slice(separatorIndex + 1);

  if (!Number.isFinite(expiresAt) || !hmac) {
    return null;
  }

  return { expiresAt, hmac };
}

function timingSafeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
  } catch {
    return false;
  }
}

export function parseExportPath(input: string): { pathname: string; query: Record<string, string> } {
  const trimmed = input.trim();
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const url = new URL(normalized, 'http://signed-url.local');

  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key === SIGNATURE_QUERY_PARAM) {
      continue;
    }
    query[key] = value;
  }

  return {
    pathname: url.pathname,
    query,
  };
}

export interface SignedUrlResult {
  pathname: string;
  query: Record<string, string>;
  expiresAt: number;
  signature: string;
}

export function signExportUrl(pathname: string, query: Record<string, string> = {}): SignedUrlResult {
  const secret = config.signedUrl.secret;
  if (!secret) {
    throw new Error('Signed URL signing is not configured');
  }

  if (!isExportReportPath(pathname)) {
    throw new Error('Path is not an allowed export or report endpoint');
  }

  const expiresAt = Math.floor(Date.now() / 1000) + config.signedUrl.expiresInSeconds;
  const hmac = createSignature(pathname, query, expiresAt, secret);
  const signature = formatSignatureToken(expiresAt, hmac);

  return {
    pathname,
    query,
    expiresAt,
    signature,
  };
}

export function buildSignedUrl(pathname: string, query: Record<string, string>, signature: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.append(key, value);
  }
  params.append(SIGNATURE_QUERY_PARAM, signature);

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function buildAbsoluteSignedUrl(
  pathname: string,
  query: Record<string, string>,
  signature: string
): string {
  const relativeUrl = buildSignedUrl(pathname, query, signature);
  const domain = config.server.domain.replace(/\/$/, '');
  return `${domain}${relativeUrl}`;
}

export function verifySignedExportUrl(pathname: string, query: Record<string, unknown>): boolean {
  const secret = config.signedUrl.secret;
  if (!secret || !isExportReportPath(pathname)) {
    return false;
  }

  const signatureToken = query[SIGNATURE_QUERY_PARAM];
  if (typeof signatureToken !== 'string') {
    return false;
  }

  const parsedToken = parseSignatureToken(signatureToken);
  if (!parsedToken || parsedToken.expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expectedHmac = createSignature(pathname, query, parsedToken.expiresAt, secret);
  return timingSafeEqualHex(parsedToken.hmac, expectedHmac);
}
