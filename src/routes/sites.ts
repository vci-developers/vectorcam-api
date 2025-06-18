import { FastifyInstance } from 'fastify';
import { 
  createSite,
  getSiteDetails,
  updateSite,
  deleteSite 
} from '../handlers/site';
import { getSiteList } from '../handlers/site/getList';

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

  done();
} 