import { FastifyInstance } from 'fastify';
import { 
  registerDevice,
  getDeviceDetails,
  updateDevice,
  deleteDevice 
} from '../handlers/device';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Register a device
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['siteId'],
        properties: {
          siteId: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            device: {
              type: 'object',
              properties: {
                deviceId: { type: 'string' },
                siteId: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, registerDevice);

  // Get device details
  fastify.get('/:device_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          device_id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            deviceId: { type: 'string' },
            siteId: { type: 'string' }
          }
        }
      }
    }
  }, getDeviceDetails);

  // Update device metadata
  fastify.put('/:device_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          device_id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['siteId'],
        properties: {
          siteId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            device: {
              type: 'object',
              properties: {
                deviceId: { type: 'string' },
                siteId: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, updateDevice);

  // Delete a device
  fastify.delete('/:device_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          device_id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, deleteDevice);

  done();
} 