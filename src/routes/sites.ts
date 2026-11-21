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
import { requirePermission, siteFromParams } from '../middleware/permission.middleware';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Get all sites with filters (list is limited to the sites the caller can read)
  fastify.get('/', {
    preHandler: [requirePermission('site:read')],
    schema: getListSchema
  }, getSiteList as any);

  // Register a new site in the caller's program
  fastify.post('/register', {
    preHandler: [requirePermission('site:create')],
    schema: createSchema
  }, createSite as any);

  fastify.get('/:site_id', {
    preHandler: [requirePermission('site:read', { site: siteFromParams })],
    schema: getSchema
  }, getSiteDetails as any);

  fastify.put('/:site_id', {
    preHandler: [requirePermission('site:write', { site: siteFromParams })],
    schema: updateSchema
  }, updateSite as any);

  fastify.delete('/:site_id', {
    preHandler: [requirePermission('site:write', { site: siteFromParams })],
    schema: deleteSchema
  }, deleteSite as any);

  // Site user management routes (system administrators only)
  fastify.get('/:siteId/users', {
    preHandler: [requirePermission('system:admin')],
    schema: getSiteUsersSchema,
  }, getSiteUsersHandler as any);

  fastify.post('/:siteId/users', {
    preHandler: [requirePermission('system:admin')],
    schema: addSiteUserSchema,
  }, addSiteUserHandler as any);

  fastify.delete('/:siteId/users/:userId', {
    preHandler: [requirePermission('system:admin')],
    schema: deleteSiteUserSchema,
  }, deleteSiteUserHandler as any);

  done();
} 