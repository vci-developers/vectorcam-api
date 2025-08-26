import { FastifyInstance } from 'fastify';
import { 
  createSite,
  getSiteDetails,
  updateSite,
  deleteSite,
  addSiteUserHandler, addSiteUserSchema,
  getSiteUsersHandler, getSiteUsersSchema,
  deleteSiteUserHandler, deleteSiteUserSchema
} from '../handlers/site';
import { getSiteList } from '../handlers/site/getList';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware';

// Import schemas from handler files
import { schema as createSchema } from '../handlers/site/post';
import { schema as getSchema } from '../handlers/site/get';
import { schema as updateSchema } from '../handlers/site/put';
import { schema as deleteSchema } from '../handlers/site/delete';
import { schema as getListSchema } from '../handlers/site/getList';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Get all sites with filters
  fastify.get('/', {
    schema: getListSchema
  }, getSiteList);

  // Register a new site
  fastify.post('/register', {
    schema: createSchema
  }, createSite);

  // Get site details
  fastify.get('/:site_id', {
    schema: getSchema
  }, getSiteDetails);

  // Update an existing site
  fastify.put('/:site_id', {
    schema: updateSchema
  }, updateSite);

  // Delete a site
  fastify.delete('/:site_id', {
    schema: deleteSchema
  }, deleteSite);

  // Site user management routes (admin only)
  
  // Get all admin users for a site
  fastify.get('/:siteId/users', {
    preHandler: [adminAuthMiddleware],
    schema: getSiteUsersSchema,
  }, getSiteUsersHandler as any);

  // Add admin user to site
  fastify.post('/:siteId/users', {
    preHandler: [adminAuthMiddleware],
    schema: addSiteUserSchema,
  }, addSiteUserHandler as any);

  // Remove admin user from site
  fastify.delete('/:siteId/users/:userId', {
    preHandler: [adminAuthMiddleware],
    schema: deleteSiteUserSchema,
  }, deleteSiteUserHandler as any);

  done();
} 