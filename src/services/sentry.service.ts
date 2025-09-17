import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { config } from '../config/environment';

export class SentryService {
  private static instance: SentryService;
  private initialized = false;

  private constructor() {}

  public static getInstance(): SentryService {
    if (!SentryService.instance) {
      SentryService.instance = new SentryService();
    }
    return SentryService.instance;
  }

  public init(): void {
    if (this.initialized) {
      return;
    }

    // Only initialize Sentry in production or if explicitly enabled
    if (config.server.nodeEnv === 'production' || config.sentry.enabled) {
      const dsn = process.env.SENTRY_DSN;
      
      if (!dsn) {
        console.warn('SENTRY_DSN not provided, Sentry will not be initialized');
        return;
      }

      Sentry.init({
        dsn,
        environment: config.server.nodeEnv,
        release: process.env.APP_VERSION || '1.0.0',
        
        // Performance monitoring
        integrations: [
          nodeProfilingIntegration(),
        ],
        
        // Set traces sample rate for performance monitoring
        tracesSampleRate: 1.0,
        
        // Set profiles sample rate for profiling
        profilesSampleRate: 1.0,
        
        // Enable debug mode in development
        debug: config.server.nodeEnv === 'development',
        
        // Configure beforeSend to filter out certain errors
        beforeSend(event, hint) {
          // Filter out health check errors or other noise
          if (event.request?.url?.includes('/health')) {
            return null;
          }
          return event;
        },
        
        // Configure beforeSendTransaction to filter out certain transactions
        beforeSendTransaction(event) {
          // Filter out health check transactions
          if (event.transaction?.includes('/health')) {
            return null;
          }
          return event;
        },
      });

      this.initialized = true;
      console.log('Sentry initialized successfully');
    }
  }

  public captureException(error: Error, context?: Record<string, any>): void {
    if (!this.initialized) {
      return;
    }

    Sentry.captureException(error, {
      extra: context,
    });
  }

  public captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): void {
    if (!this.initialized) {
      return;
    }

    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }

  public setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setUser(user);
  }

  public setTag(key: string, value: string): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setTag(key, value);
  }

  public setContext(name: string, context: Record<string, any>): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setContext(name, context);
  }

  public addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    if (!this.initialized) {
      return;
    }

    Sentry.addBreadcrumb(breadcrumb);
  }

  public flush(timeout?: number): Promise<boolean> {
    if (!this.initialized) {
      return Promise.resolve(true);
    }

    return Sentry.flush(timeout);
  }

  public close(): Promise<boolean> {
    if (!this.initialized) {
      return Promise.resolve(true);
    }

    return Sentry.close();
  }
}

export const sentryService = SentryService.getInstance(); 