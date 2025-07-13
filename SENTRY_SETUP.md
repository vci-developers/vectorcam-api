# Sentry Integration Setup

This document explains how to set up Sentry error monitoring and logging for the VectorCam API.

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Sentry Configuration
SENTRY_ENABLED=true
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
APP_VERSION=1.0.0
```

## Configuration

### SENTRY_ENABLED
- **Type**: boolean
- **Default**: false
- **Description**: Enable or disable Sentry integration. Set to `true` to enable Sentry.

### SENTRY_DSN
- **Type**: string
- **Required**: Yes (when SENTRY_ENABLED=true)
- **Description**: Your Sentry DSN (Data Source Name) from your Sentry project settings.

### APP_VERSION
- **Type**: string
- **Default**: "1.0.0"
- **Description**: The version of your application for release tracking in Sentry.

## Features

### Error Monitoring
- Automatic capture of unhandled exceptions
- Request context information (headers, query params, body)
- User information (when available)
- Performance monitoring with traces and profiles

### Logging Integration
- All server logs are sent to Sentry as breadcrumbs
- Error and fatal log levels are captured as Sentry events
- Custom logger wrapper maintains original logging behavior

### Request Tracking
- Automatic request/response monitoring
- Performance metrics for API endpoints
- Filtering of health check endpoints to reduce noise

### Environment-Specific Configuration
- **Development**: Full debug mode, 100% sample rate
- **Production**: Optimized for performance, 10% sample rate
- **Test**: Minimal logging to avoid noise

## Usage

### Manual Error Reporting

```typescript
import { sentryService } from './services/sentry.service';

// Capture exceptions
try {
  // Some risky operation
} catch (error) {
  sentryService.captureException(error, {
    extra: { context: 'user_action' }
  });
}

// Capture messages
sentryService.captureMessage('Something went wrong', 'error', {
  extra: { userId: '123' }
});

// Add breadcrumbs
sentryService.addBreadcrumb({
  category: 'user',
  message: 'User performed action',
  level: 'info',
  data: { action: 'button_click' }
});
```

### Setting User Context

```typescript
// Set user information for better error tracking
sentryService.setUser({
  id: 'user123',
  email: 'user@example.com',
  username: 'john_doe'
});
```

### Adding Custom Context

```typescript
// Add additional context to errors
sentryService.setContext('database', {
  query: 'SELECT * FROM users',
  duration: 150
});

// Add tags for filtering
sentryService.setTag('feature', 'user_management');
```

## Performance Monitoring

The integration includes:
- **Transaction monitoring**: Automatic tracking of HTTP requests
- **Performance profiling**: CPU and memory profiling (Node.js 18+)
- **Database query monitoring**: Track slow database operations
- **Custom performance metrics**: Add custom timing data

## Filtering and Noise Reduction

The integration automatically filters:
- Health check endpoints (`/health`)
- Development environment noise
- Repeated errors (deduplication)

## Graceful Shutdown

Sentry events are flushed during graceful shutdown to ensure no data is lost.

## Troubleshooting

### Sentry Not Initializing
1. Check that `SENTRY_DSN` is set correctly
2. Verify `SENTRY_ENABLED=true` in your environment
3. Check console for initialization messages

### Missing Error Context
1. Ensure Sentry middleware is registered
2. Check that error handler is properly set
3. Verify logger integration is working

### Performance Issues
1. Reduce sample rates in production
2. Filter unnecessary endpoints
3. Monitor Sentry quota usage

## Security Considerations

- DSN is safe to include in client-side code
- No sensitive data is automatically sent to Sentry
- Review and configure `beforeSend` filters as needed
- Consider data retention policies in Sentry settings 