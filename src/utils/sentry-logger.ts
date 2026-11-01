import { FastifyBaseLogger } from 'fastify';
import { loggedError } from '../services/sentry-http';
import { sentryService } from '../services/sentry.service';
import { stashRequestError } from '../services/sentry-request-errors';

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
    const msg = typeof obj === 'string' ? obj : JSON.stringify(obj);
    sentryService.addBreadcrumb({
      category: 'log',
      message: msg,
      level: 'info',
      data: args.length > 0 ? args : undefined,
    });
  }

  warn(obj: unknown, ...args: any[]): void {
    this.logger.warn(obj, ...args);
    const msg = typeof obj === 'string' ? obj : JSON.stringify(obj);
    sentryService.addBreadcrumb({
      category: 'log',
      message: msg,
      level: 'warning',
      data: args.length > 0 ? args : undefined,
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

    const msg = typeof obj === 'string' ? obj : JSON.stringify(obj);
    sentryService.captureMessage(msg, 'error', {
      extra: args.length > 0 ? args : undefined,
    });
  }

  debug(obj: unknown, ...args: any[]): void {
    this.logger.debug(obj, ...args);
    const msg = typeof obj === 'string' ? obj : JSON.stringify(obj);
    sentryService.addBreadcrumb({
      category: 'log',
      message: msg,
      level: 'debug',
      data: args.length > 0 ? args : undefined,
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

    const msg = typeof obj === 'string' ? obj : JSON.stringify(obj);
    sentryService.captureMessage(msg, 'fatal', {
      extra: args.length > 0 ? args : undefined,
    });
  }

  trace(obj: unknown, ...args: any[]): void {
    this.logger.trace(obj, ...args);
    const msg = typeof obj === 'string' ? obj : JSON.stringify(obj);
    sentryService.addBreadcrumb({
      category: 'log',
      message: msg,
      level: 'debug',
      data: args.length > 0 ? args : undefined,
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