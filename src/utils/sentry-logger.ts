import { FastifyBaseLogger } from 'fastify';
import { loggedError } from '../services/sentry-http';
import { sentryService } from '../services/sentry.service';
import { stashRequestError } from '../services/sentry-request-errors';

function logMessage(obj: unknown, args: unknown[]): string {
  const message = args.find((arg) => typeof arg === 'string');
  if (typeof message === 'string') {
    return message;
  }
  if (typeof obj === 'string') {
    return obj;
  }
  if (obj instanceof Error) {
    return obj.message;
  }
  return 'log';
}

export class SentryLogger implements FastifyBaseLogger {
  private logger: FastifyBaseLogger;
  private bindings: Record<string, unknown>;

  constructor(logger: FastifyBaseLogger, bindings: Record<string, unknown> = {}) {
    this.logger = logger;
    this.bindings = bindings;
  }

  private rememberRequestError(obj: unknown, args: unknown[]): void {
    const requestId = this.bindings.reqId;
    if (requestId == null) {
      return;
    }
    const error = loggedError(obj, args);
    if (error) {
      stashRequestError(String(requestId), error);
    }
  }

  get level(): string {
    return this.logger.level;
  }

  info(obj: unknown, ...args: any[]): void {
    this.logger.info(obj, ...args);
    sentryService.addBreadcrumb({
      category: 'log',
      message: logMessage(obj, args),
      level: 'info',
    });
  }

  warn(obj: unknown, ...args: any[]): void {
    this.logger.warn(obj, ...args);
    sentryService.addBreadcrumb({
      category: 'log',
      message: logMessage(obj, args),
      level: 'warning',
    });
  }

  error(obj: unknown, ...args: any[]): void {
    this.logger.error(obj, ...args);
    this.rememberRequestError(obj, args);
    if (this.bindings.reqId != null) {
      return;
    }

    const error = loggedError(obj, args);
    if (error) {
      sentryService.captureException(error);
      return;
    }

    sentryService.captureMessage(logMessage(obj, args), 'error');
  }

  debug(obj: unknown, ...args: any[]): void {
    this.logger.debug(obj, ...args);
    sentryService.addBreadcrumb({
      category: 'log',
      message: logMessage(obj, args),
      level: 'debug',
    });
  }

  fatal(obj: unknown, ...args: any[]): void {
    this.logger.fatal(obj, ...args);
    this.rememberRequestError(obj, args);
    if (this.bindings.reqId != null) {
      return;
    }

    const error = loggedError(obj, args);
    if (error) {
      sentryService.captureException(error, { level: 'fatal' });
      return;
    }

    sentryService.captureMessage(logMessage(obj, args), 'fatal');
  }

  trace(obj: unknown, ...args: any[]): void {
    this.logger.trace(obj, ...args);
    sentryService.addBreadcrumb({
      category: 'log',
      message: logMessage(obj, args),
      level: 'debug',
    });
  }

  silent(obj: unknown, ...args: any[]): void {
    this.logger.silent(obj, ...args);
    // Don't send silent logs to Sentry
  }

  child(bindings: object, options?: object): FastifyBaseLogger {
    const childLogger = options
      ? this.logger.child(bindings, options)
      : this.logger.child(bindings);
    return new SentryLogger(childLogger, { ...this.bindings, ...bindings });
  }
} 