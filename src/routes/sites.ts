import { FastifyInstance } from 'fastify';
import { 
  registerSite,
  getSiteDetails,
  updateSite,
  deleteSite 
} from '../handlers/site';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Register a new site
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['healthCenterId'],
        properties: {
          healthCenterId: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          houseNumber: { type: 'number' },
          villageName: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            site: {
              type: 'object',
              properties: {
                siteId: { type: 'string' },
                healthCenterId: { type: 'string' },
                latitude: { type: ['number', 'null'] },
                longitude: { type: ['number', 'null'] },
                houseNumber: { type: ['number', 'null'] },
                villageName: { type: ['string', 'null'] }
              }
            }
          }
        }
      }
    }
  }, registerSite);

  // Get site details
  fastify.get('/:site_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          site_id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            siteId: { type: 'string' },
            healthCenterId: { type: 'string' },
            latitude: { type: ['number', 'null'] },
            longitude: { type: ['number', 'null'] },
            houseNumber: { type: ['number', 'null'] },
            villageName: { type: ['string', 'null'] }
          }
        }
      }
    }
  }, getSiteDetails);

  // Update an existing site
  fastify.put('/:site_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          site_id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          healthCenterId: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          houseNumber: { type: 'number' },
          villageName: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            site: {
              type: 'object',
              properties: {
                siteId: { type: 'string' },
                healthCenterId: { type: 'string' },
                latitude: { type: ['number', 'null'] },
                longitude: { type: ['number', 'null'] },
                houseNumber: { type: ['number', 'null'] },
                villageName: { type: ['string', 'null'] }
              }
            }
          }
        }
      }
    }
  }, updateSite);

  // Delete a site
  fastify.delete('/:site_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          site_id: { type: 'string' }
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
  }, deleteSite);

  done();
} 