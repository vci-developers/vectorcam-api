import { FastifyInstance } from 'fastify';
import { 
  addToWhitelistHandler, addToWhitelistSchema,
  getWhitelistHandler, getWhitelistSchema,
  removeFromWhitelistHandler, removeFromWhitelistSchema,
  getProfileHandler, getProfileSchema,
  getUsersHandler, getUsersSchema,
  modifyUserHandler, modifyUserSchema,
  getPermissionsHandler, getPermissionsSchema,
  resetPasswordHandler, resetPasswordSchema,
  sendEmailVerificationHandler, sendEmailVerificationSchema,
  verifyEmailHandler, verifyEmailSchema,
  getActiveUserMetricsHandler, getActiveUserMetricsSchema,
  getUserAuthEventsHandler, getUserAuthEventsSchema,
  exportUserAuthEventsReportHandler, exportUserAuthEventsReportSchema,
  getUserRolesHandler, getUserRolesSchema,
  updateUserRolesHandler, updateUserRolesSchema,
} from '../handlers/user';
import { requireNonWhitelistedUserAuth, requireUserAuth } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { requireSignedResourceAuth } from '../middleware/signedUrl.middleware';

/**
 * User management routes
 */
export default async function userRoutes(server: FastifyInstance): Promise<void> {
  // Get current user profile (requires authentication)
  server.get('/profile', {
    preHandler: [requireNonWhitelistedUserAuth],
    schema: getProfileSchema,
  }, getProfileHandler);

  // Send email verification link to the current user
  server.post('/email/send-verification', {
    preHandler: [requireNonWhitelistedUserAuth],
    schema: sendEmailVerificationSchema,
  }, sendEmailVerificationHandler);

  // Verify the current user's email with a token from the verification email
  server.post('/email/verify', {
    preHandler: [requireNonWhitelistedUserAuth],
    schema: verifyEmailSchema,
  }, verifyEmailHandler as any);

  // Get current user permissions (requires user authentication)
  server.get('/permissions', {
    preHandler: [requireUserAuth],
    schema: getPermissionsSchema,
  }, getPermissionsHandler as any);

  // Get all users (requires admin auth token)
  server.get('/', {
    preHandler: [requirePermission('system:admin')],
    schema: getUsersSchema,
  }, getUsersHandler as any);

  // List active user metrics snapshots (requires admin token or developer user)
  server.get('/active-metrics', {
    preHandler: [requirePermission('system:admin')],
    schema: getActiveUserMetricsSchema,
  }, getActiveUserMetricsHandler as any);

  // Export user login activity report as XLSX (admin token, developer user, or signed URL)
  server.get('/auth-events/report', {
    preHandler: [requireSignedResourceAuth],
    schema: exportUserAuthEventsReportSchema,
  }, exportUserAuthEventsReportHandler as any);

  // List user auth events (requires admin token or developer user)
  server.get('/auth-events', {
    preHandler: [requirePermission('system:admin')],
    schema: getUserAuthEventsSchema,
  }, getUserAuthEventsHandler as any);

  // Add email to whitelist (requires admin auth token)
  server.post('/whitelist', {
    preHandler: [requirePermission('system:admin')],
    schema: addToWhitelistSchema,
  }, addToWhitelistHandler as any);

  // Get whitelist entries (requires admin auth token)
  server.get('/whitelist', {
    preHandler: [requirePermission('system:admin')],
    schema: getWhitelistSchema,
  }, getWhitelistHandler);

  // Remove email from whitelist (requires admin auth token)
  server.delete('/whitelist/:id', {
    preHandler: [requirePermission('system:admin')],
    schema: removeFromWhitelistSchema,
  }, removeFromWhitelistHandler as any);

  // Modify user fields and roles
  server.put('/:id', {
    preHandler: [requirePermission('system:admin')],
    schema: modifyUserSchema,
  }, modifyUserHandler as any);

  server.get('/:id/roles', {
    preHandler: [requirePermission('system:admin')],
    schema: getUserRolesSchema,
  }, getUserRolesHandler as any);

  server.put('/:id/roles', {
    preHandler: [requirePermission('system:admin')],
    schema: updateUserRolesSchema,
  }, updateUserRolesHandler as any);

  // Reset user password (requires admin auth token)
  server.put('/:id/reset-password', {
    preHandler: [requirePermission('system:admin')],
    schema: resetPasswordSchema,
  }, resetPasswordHandler as any);
}
