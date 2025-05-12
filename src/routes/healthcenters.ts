import { FastifyInstance } from 'fastify';
import { 
  createHealthCenter,
  getHealthCenterDetails,
  updateHealthCenter,
  deleteHealthCenter 
} from '../handlers/healthcenter';

// Import schemas from handler files
import { schema as createSchema } from '../handlers/healthcenter/post';
import { schema as getSchema } from '../handlers/healthcenter/get';
import { schema as updateSchema } from '../handlers/healthcenter/put';
import { schema as deleteSchema } from '../handlers/healthcenter/delete';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Register a new health center
  fastify.post('/register', {
    schema: createSchema
  }, createHealthCenter);

  // Get health center details
  fastify.get('/:healthcenter_id', {
    schema: getSchema
  }, getHealthCenterDetails);

  // Update an existing health center
  fastify.put('/:healthcenter_id', {
    schema: updateSchema
  }, updateHealthCenter);

  // Delete a health center
  fastify.delete('/:healthcenter_id', {
    schema: deleteSchema
  }, deleteHealthCenter);

  done();
} 