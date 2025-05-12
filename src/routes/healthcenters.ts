import { FastifyInstance } from 'fastify';
import { 
  registerHealthCenter,
  getHealthCenterDetails,
  updateHealthCenter,
  deleteHealthCenter 
} from '../handlers/healthcenter';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Register a new health center
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['parish', 'subcounty', 'district', 'country'],
        properties: {
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          parish: { type: 'string' },
          subcounty: { type: 'string' },
          district: { type: 'string' },
          country: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            healthCenter: {
              type: 'object',
              properties: {
                healthCenterId: { type: 'string' },
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                parish: { type: 'string' },
                subcounty: { type: 'string' },
                district: { type: 'string' },
                country: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, registerHealthCenter);

  // Get health center details
  fastify.get('/:healthcenter_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          healthcenter_id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            healthCenterId: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            parish: { type: 'string' },
            subcounty: { type: 'string' },
            district: { type: 'string' },
            country: { type: 'string' }
          }
        }
      }
    }
  }, getHealthCenterDetails);

  // Update an existing health center
  fastify.put('/:healthcenter_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          healthcenter_id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          parish: { type: 'string' },
          subcounty: { type: 'string' },
          district: { type: 'string' },
          country: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            healthCenter: {
              type: 'object',
              properties: {
                healthCenterId: { type: 'string' },
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                parish: { type: 'string' },
                subcounty: { type: 'string' },
                district: { type: 'string' },
                country: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, updateHealthCenter);

  // Delete a health center
  fastify.delete('/:healthcenter_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          healthcenter_id: { type: 'string' }
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
  }, deleteHealthCenter);

  done();
} 