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

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Get all devices with filters
  fastify.get('/', {
    schema: getListSchema
  }, getDeviceList);

  // Register a device
  fastify.post('/register', {
    schema: createSchema
  }, createDevice);

  // Get device details
  fastify.get('/:device_id', {
    schema: getSchema
  }, getDeviceDetails);

  // Update device metadata
  fastify.put('/:device_id', {
    schema: updateSchema
  }, updateDevice);

  // Delete a device
  fastify.delete('/:device_id', {
    schema: deleteSchema
  }, deleteDevice);

  done();
} 