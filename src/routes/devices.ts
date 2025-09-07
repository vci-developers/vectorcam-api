import { FastifyInstance } from 'fastify';
import { 
  createDevice,
  getDeviceDetails,
  updateDevice,
  deleteDevice 
} from '../handlers/device';
import { getDeviceList } from '../handlers/device/getList';

// Import schemas from handler files
import { schema as createSchema } from '../handlers/device/post';
import { schema as getSchema } from '../handlers/device/get';
import { schema as updateSchema } from '../handlers/device/put';
import { schema as deleteSchema } from '../handlers/device/delete';
import { schema as getListSchema } from '../handlers/device/getList';
import { requireMobileAuth } from '../middleware/auth.middleware';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Get all devices with filters
  fastify.get('/', {
    preHandler: [requireMobileAuth],
    schema: getListSchema
  }, getDeviceList as any);

  // Register a device
  fastify.post('/register', {
    preHandler: [requireMobileAuth],
    schema: createSchema
  }, createDevice as any);

  // Get device details
  fastify.get('/:device_id', {
    preHandler: [requireMobileAuth],
    schema: getSchema
  }, getDeviceDetails as any);

  // Update device metadata
  fastify.put('/:device_id', {
    preHandler: [requireMobileAuth],
    schema: updateSchema
  }, updateDevice as any);

  // Delete a device
  fastify.delete('/:device_id', {
    preHandler: [requireMobileAuth],
    schema: deleteSchema
  }, deleteDevice as any);

  done();
} 