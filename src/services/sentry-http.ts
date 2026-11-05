export function shouldRecordHttpStatus(statusCode: number): boolean {
  return statusCode >= 400 && statusCode <= 599;
}

/**
 * Skip responses that are internet background noise rather than API usage:
 * - requests that matched no route (bots probing /.env, /wp-login.php, /favicon.ico, ...)
 * - CORS preflight (OPTIONS) failures, which scanners trigger with `OPTIONS *`
 * 404s returned by real route handlers (e.g. "Session not found") are still recorded.
 */
export function isBotNoise(request: { method: string; is404?: boolean }): boolean {
  return request.is404 === true || request.method.toUpperCase() === 'OPTIONS';
}

/**
 * The mobile app checks whether a record already exists before uploading it, so a
 * 404 on these lookups is the normal "not uploaded yet" answer, not a failure.
 */
const MOBILE_EXISTENCE_CHECK_ROUTES = new Set([
  'GET /specimens/:specimen_id/images/data/:image_id',
  'GET /sessions/:session_id/specimens/:specimen_id',
  'GET /sessions/:session_id',
  'GET /sessions/:session_id/survey',
]);

/**
 * Expected client responses that are not worth a Sentry event:
 * - 401: missing/expired credentials are routine
 * - 404 on the mobile app's "does it exist yet?" lookups (mobile token only)
 * Other 4xx (including 403 and 404s from other routes) are still recorded.
 */
export function isExpectedClientResponse(input: {
  statusCode: number;
  method: string;
  route: string;
  isMobileApp?: boolean;
}): boolean {
  if (input.statusCode === 401) {
    return true;
  }
  return (
    input.statusCode === 404 &&
    input.isMobileApp === true &&
    MOBILE_EXISTENCE_CHECK_ROUTES.has(`${input.method.toUpperCase()} ${input.route}`)
  );
}

export function routeTemplate(routeUrl: string | undefined, url: string): string {
  if (routeUrl) {
    return routeUrl;
  }
  return url.split('?')[0];
}

export function responseErrorText(payload: unknown): string | undefined {
  let text: string | undefined;
  if (typeof payload === 'string') {
    text = payload;
  } else if (Buffer.isBuffer(payload)) {
    text = payload.toString('utf8');
  }
  if (!text || text.length > 10000) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const value = typeof parsed?.error === 'string' ? parsed.error : parsed?.message;
    if (typeof value === 'string' && value.trim()) {
      return value.trim().slice(0, 300);
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function httpEventMessage(
  statusCode: number,
  method: string,
  route: string,
  detail?: string
): string {
  const base = `HTTP ${statusCode} ${method} ${route}`;
  return detail ? `${base}: ${detail}` : base;
}

export function markUnhandledCrash(event: {
  level?: string;
  tags?: { [key: string]: unknown };
  exception?: {
    values?: Array<{ mechanism?: { handled?: boolean } | null } | null> | null;
  } | null;
}): void {
  const unhandled = event.exception?.values?.some((value) => value?.mechanism?.handled === false) ?? false;
  if (!unhandled) {
    return;
  }

  event.tags = { ...(event.tags ?? {}), crash: 'true' };
  event.level = 'fatal';
}

const SENSITIVE_HEADER = /^(authorization|cookie|set-cookie|x-api-key|proxy-authorization)$/i;
const SENSITIVE_FIELD = /password|token|secret|authorization|cookie|api[-_]?key/i;
const MAX_BODY_CHARS = 8000;

export function requestPath(url: string): string {
  return url.split('?')[0];
}

export function sentryHeaders(headers: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }

  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) {
      continue;
    }
    const text = Array.isArray(value) ? value.map(String).join(', ') : String(value);
    redacted[key] = SENSITIVE_HEADER.test(key) ? '[redacted]' : text;
  }
  return redacted;
}

export function sentryBody(body: unknown): unknown {
  if (body == null) {
    return undefined;
  }
  if (Buffer.isBuffer(body)) {
    return `[binary ${body.length} bytes]`;
  }
  if (typeof body === 'object' && 'pipe' in body) {
    return '[stream]';
  }

  let value = body;
  if (typeof body === 'string') {
    try {
      value = JSON.parse(body);
    } catch {
      return body.length > MAX_BODY_CHARS ? `${body.slice(0, MAX_BODY_CHARS)}…` : body;
    }
  }

  try {
    const redacted = redactValue(JSON.parse(JSON.stringify(value)));
    const serialized = JSON.stringify(redacted);
    if (serialized.length <= MAX_BODY_CHARS) {
      return redacted;
    }
    return `${serialized.slice(0, MAX_BODY_CHARS)}…`;
  } catch {
    return undefined;
  }
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      redacted[key] = SENSITIVE_FIELD.test(key) ? '[redacted]' : redactValue(child);
    }
    return redacted;
  }
  return value;
}

export function loggedError(obj: unknown, args: unknown[]): Error | undefined {
  if (obj instanceof Error) {
    return obj;
  }
  if (obj && typeof obj === 'object' && 'err' in obj && obj.err instanceof Error) {
    return obj.err;
  }
  return args.find((arg): arg is Error => arg instanceof Error);
}
