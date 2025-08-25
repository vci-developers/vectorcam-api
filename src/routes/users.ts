import { FastifyInstance } from 'fastify';
import { authMiddleware, requireAdmin, requireWhitelisted } from '../middleware/auth.middleware';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware';
import { 
  addToWhitelistHandler, addToWhitelistSchema,
  getWhitelistHandler, getWhitelistSchema,
  removeFromWhitelistHandler, removeFromWhitelistSchema,
  getProfileHandler, getProfileSchema,
  getUsersHandler, getUsersSchema,
  modifyUserHandler, modifyUserSchema
} from '../handlers/user';

/**
 * User management routes
 */
export default async function userRoutes(server: FastifyInstance): Promise<void> {
  // Get current user profile (requires authentication)
  server.get('/profile', {
    preHandler: [authMiddleware],
    schema: getProfileSchema,
  }, getProfileHandler);

  // Get all users (requires admin auth token)
  server.get('/', {
    preHandler: [adminAuthMiddleware],
    schema: getUsersSchema,
  }, getUsersHandler);

  // Add email to whitelist (requires admin auth token)
  server.post('/whitelist', {
    preHandler: [adminAuthMiddleware],
    schema: addToWhitelistSchema,
  }, addToWhitelistHandler as any);

  // Get whitelist entries (requires admin auth token)
  server.get('/whitelist', {
    preHandler: [adminAuthMiddleware],
    schema: getWhitelistSchema,
  }, getWhitelistHandler);

  // Remove email from whitelist (requires admin auth token)
  server.delete('/whitelist/:id', {
    preHandler: [adminAuthMiddleware],
    schema: removeFromWhitelistSchema,
  }, removeFromWhitelistHandler as any);

  // Modify user privileges (requires admin auth token)
  server.put('/:id', {
    preHandler: [adminAuthMiddleware],
    schema: modifyUserSchema,
  }, modifyUserHandler as any);
}
