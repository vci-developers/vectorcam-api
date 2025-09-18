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

// Import schemas from handler files
import { schema as createSchema } from '../handlers/site/post';
import { schema as getSchema } from '../handlers/site/get';
import { schema as updateSchema } from '../handlers/site/put';
import { schema as deleteSchema } from '../handlers/site/delete';
import { schema as getListSchema } from '../handlers/site/getList';
import { requireAdminAuth } from '../middleware/auth.middleware';
import { 
  siteAccessMiddleware,
  requireSiteReadAccess,
  requireSiteWriteAccess,
  requireSpecificSiteReadAccess,
  requireSpecificSiteWriteAccess
} from '../middleware/siteAccess.middleware';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Register site access middleware for all routes
  fastify.addHook('preHandler', siteAccessMiddleware);

  // Get all sites with filters (requires read access)
  fastify.get('/', {
    preHandler: [requireSiteReadAccess],
    schema: getListSchema
  }, getSiteList as any);

  // Register a new site (requires write access)
  fastify.post('/register', {
    preHandler: [requireSiteWriteAccess],
    schema: createSchema
  }, createSite as any);

  // Get site details (requires access to specific site)
  fastify.get('/:site_id', {
    preHandler: [requireSpecificSiteReadAccess],
    schema: getSchema
  }, getSiteDetails as any);

  // Update an existing site (requires write access to specific site)
  fastify.put('/:site_id', {
    preHandler: [requireSpecificSiteWriteAccess],
    schema: updateSchema
  }, updateSite as any);

  // Delete a site (requires write access to specific site)
  fastify.delete('/:site_id', {
    preHandler: [requireSpecificSiteWriteAccess],
    schema: deleteSchema
  }, deleteSite as any);

  // Site user management routes (requires admin privileges and site access)
  
  // Get all admin users for a site
  fastify.get('/:siteId/users', {
    preHandler: [requireAdminAuth],
    schema: getSiteUsersSchema,
  }, getSiteUsersHandler as any);

  // Add admin user to site
  fastify.post('/:siteId/users', {
    preHandler: [requireAdminAuth],
    schema: addSiteUserSchema,
  }, addSiteUserHandler as any);

  // Remove admin user from site
  fastify.delete('/:siteId/users/:userId', {
    preHandler: [requireAdminAuth],
    schema: deleteSiteUserSchema,
  }, deleteSiteUserHandler as any);

  done();
} 