import { FastifyInstance } from 'fastify';
import { 
  createSite,
  getSiteDetails,
  updateSite,
  deleteSite 
} from '../handlers/site';

// Import schemas from handler files
import { schema as createSchema } from '../handlers/site/post';
import { schema as getSchema } from '../handlers/site/get';
import { schema as updateSchema } from '../handlers/site/put';
import { schema as deleteSchema } from '../handlers/site/delete';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
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