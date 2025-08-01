import { FastifyBaseLogger } from 'fastify';
import { sentryService } from '../services/sentry.service';

export class SentryLogger implements FastifyBaseLogger {
  private logger: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
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
    const msg = typeof obj === 'string' ? obj : JSON.stringify(obj);
    
    // Check if this is a client error (4xx) that shouldn't be captured
    let isClientError = false;
    
    if (args.length > 0 && args[0] instanceof Error) {
      const error = args[0] as any;
      // Only check for explicit 4xx status codes
      if (error.statusCode >= 400 && error.statusCode < 500) {
        isClientError = true;
      }
    }
    
    // Also check for common client error patterns in the message
    if (msg.includes('Client error') || 
        msg.includes('Validation error') ||
        msg.includes('not captured in Sentry')) {
      isClientError = true;
    }
    
    // Don't capture client errors in Sentry
    if (isClientError) {
      return;
    }
    
    // Capture actual server errors in Sentry
    if (args.length > 0 && args[0] instanceof Error) {
      sentryService.captureException(args[0], {
        extra: {
          message: msg,
          additionalArgs: args.slice(1),
        },
      });
    } else {
      sentryService.captureMessage(msg, 'error', {
        extra: args.length > 0 ? args : undefined,
      });
    }
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
    const msg = typeof obj === 'string' ? obj : JSON.stringify(obj);
    
    // Capture fatal errors in Sentry
    if (args.length > 0 && args[0] instanceof Error) {
      sentryService.captureException(args[0], {
        level: 'fatal',
        extra: {
          message: msg,
          additionalArgs: args.slice(1),
        },
      });
    } else {
      sentryService.captureMessage(msg, 'fatal', {
        extra: args.length > 0 ? args : undefined,
      });
    }
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

  child(bindings: object): FastifyBaseLogger {
    const childLogger = this.logger.child(bindings);
    return new SentryLogger(childLogger);
  }
} 