import { FastifyInstance } from 'fastify';
import { 
  submitSession,
  getSessionDetails,
  updateSession,
  deleteSession,
  getSessionPaginated,
  getSessionsByUser,
  getSessionsBySite,
  getSessionSurvey,
  getSessionSpecimens,
  exportSessionsCSV
} from '../handlers/session';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Submit a new session
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['deviceId', 'siteId', 'createdAt'],
        properties: {
          deviceId: { type: 'string' },
          siteId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            session: {
              type: 'object',
              properties: {
                sessionId: { type: 'string' },
                deviceId: { type: 'string' },
                siteId: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                submittedAt: { type: ['string', 'null'], format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }, submitSession);

  // Get session details by ID
  fastify.get('/:session_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          session_id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            deviceId: { type: 'string' },
            siteId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            submittedAt: { type: ['string', 'null'], format: 'date-time' }
          }
        }
      }
    }
  }, getSessionDetails);

  // Update an existing session
  fastify.put('/:session_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          session_id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          siteId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            session: {
              type: 'object',
              properties: {
                sessionId: { type: 'string' },
                deviceId: { type: 'string' },
                siteId: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                submittedAt: { type: ['string', 'null'], format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }, updateSession);

  // Delete a session
  fastify.delete('/:session_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          session_id: { type: 'string' }
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
  }, deleteSession);

  // Get paginated list of sessions
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          size: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            totalItems: { type: 'number' },
            totalPages: { type: 'number' },
            currentPage: { type: 'number' },
            sessions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  deviceId: { type: 'string' },
                  siteId: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  submittedAt: { type: ['string', 'null'], format: 'date-time' }
                }
              }
            }
          }
        }
      }
    }
  }, getSessionPaginated);

  // Get sessions by user
  fastify.get('/users/:user_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          user_id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            sessions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  deviceId: { type: 'string' },
                  siteId: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  submittedAt: { type: ['string', 'null'], format: 'date-time' }
                }
              }
            }
          }
        }
      }
    }
  }, getSessionsByUser);

  // Get sessions by site
  fastify.get('/sites/:site_id', {
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
            sessions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  deviceId: { type: 'string' },
                  siteId: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  submittedAt: { type: ['string', 'null'], format: 'date-time' }
                }
              }
            }
          }
        }
      }
    }
  }, getSessionsBySite);

  // Get the surveillance form associated with a session
  fastify.get('/:session_id/survey', {
    schema: {
      params: {
        type: 'object',
        properties: {
          session_id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            formId: { type: 'string' },
            sessionId: { type: 'string' },
            collectionDate: { type: ['string', 'null'] },
            officerName: { type: ['string', 'null'] },
            officerTitle: { type: ['string', 'null'] },
            peopleInHouse: { type: ['number', 'null'] },
            isBednetAvailable: { type: ['boolean', 'null'] },
            numberOfBednetsAvailable: { type: ['number', 'null'] },
            numberOfPeopleSleptUnderBednet: { type: ['number', 'null'] },
            bednetType: { type: ['string', 'null'] },
            bednetBrand: { type: ['string', 'null'] },
            isIrsSprayed: { type: ['boolean', 'null'] },
            irsDate: { type: ['string', 'null'] }
          }
        }
      }
    }
  }, getSessionSurvey);

  // Get all specimens from a session
  fastify.get('/:session_id/specimens', {
    schema: {
      params: {
        type: 'object',
        properties: {
          session_id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            specimens: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  specimenId: { type: 'string' },
                  sessionId: { type: 'string' },
                  species: { type: ['string', 'null'] },
                  sex: { type: ['string', 'null'] },
                  abdomenStatus: { type: ['string', 'null'] },
                  imageUrl: { type: ['string', 'null'] },
                  yoloBox: {
                    type: ['object', 'null'],
                    properties: {
                      yoloBoxId: { type: 'string' },
                      topLeftX: { type: 'number' },
                      topLeftY: { type: 'number' },
                      width: { type: 'number' },
                      height: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, getSessionSpecimens);

  // Export all session data as CSV
  fastify.get('/export', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['csv'] }
        }
      }
    }
  }, exportSessionsCSV);

  done();
} 