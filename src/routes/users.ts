import { FastifyInstance } from 'fastify';
import { 
  addToWhitelistHandler, addToWhitelistSchema,
  getWhitelistHandler, getWhitelistSchema,
  removeFromWhitelistHandler, removeFromWhitelistSchema,
  getProfileHandler, getProfileSchema,
  getUsersHandler, getUsersSchema,
  modifyUserHandler, modifyUserSchema
} from '../handlers/user';
import { requireAdminAuth, requireNonWhitelistedUserAuth } from '../middleware/auth.middleware';

/**
 * User management routes
 */
export default async function userRoutes(server: FastifyInstance): Promise<void> {
  // Get current user profile (requires authentication)
  server.get('/profile', {
    preHandler: [requireNonWhitelistedUserAuth],
    schema: getProfileSchema,
  }, getProfileHandler);

  // Get all users (requires admin auth token)
  server.get('/', {
    preHandler: [requireAdminAuth],
    schema: getUsersSchema,
  }, getUsersHandler);

  // Add email to whitelist (requires admin auth token)
  server.post('/whitelist', {
    preHandler: [requireAdminAuth],
    schema: addToWhitelistSchema,
  }, addToWhitelistHandler as any);

  // Get whitelist entries (requires admin auth token)
  server.get('/whitelist', {
    preHandler: [requireAdminAuth],
    schema: getWhitelistSchema,
  }, getWhitelistHandler);

  // Remove email from whitelist (requires admin auth token)
  server.delete('/whitelist/:id', {
    preHandler: [requireAdminAuth],
    schema: removeFromWhitelistSchema,
  }, removeFromWhitelistHandler as any);

  // Modify user privileges (requires admin auth token)
  server.put('/:id', {
    preHandler: [requireAdminAuth],
    schema: modifyUserSchema,
  }, modifyUserHandler as any);
}
