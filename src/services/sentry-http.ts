export function shouldRecordHttpStatus(statusCode: number): boolean {
  return statusCode >= 400 && statusCode <= 599;
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

export function loggedError(obj: unknown, args: unknown[]): Error | undefined {
  if (obj instanceof Error) {
    return obj;
  }
  if (obj && typeof obj === 'object' && 'err' in obj && obj.err instanceof Error) {
    return obj.err;
  }
  return args.find((arg): arg is Error => arg instanceof Error);
}
