import { FastifyInstance } from 'fastify';
import { 
  uploadSpecimen,
  uploadImage,
  getImages,
  getImageMetadata,
  triggerInference,
  getSpecimenDetails,
  updateSpecimen 
} from '../handlers/specimen';
import fastifyMultipart from '@fastify/multipart';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Register multipart support for file uploads
  fastify.register(fastifyMultipart);

  // Upload text data about a specimen
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['specimenId', 'sessionId', 'yoloBox'],
        properties: {
          specimenId: { type: 'string' },
          sessionId: { type: 'string' },
          species: { type: 'string' },
          sex: { type: 'string' },
          abdomenStatus: { type: 'string' },
          yoloBox: {
            type: 'object',
            required: ['topLeftX', 'topLeftY', 'width', 'height'],
            properties: {
              topLeftX: { type: 'number' },
              topLeftY: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' }
            }
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            specimen: {
              type: 'object',
              properties: {
                specimenId: { type: 'string' },
                sessionId: { type: 'string' },
                species: { type: ['string', 'null'] },
                sex: { type: ['string', 'null'] },
                abdomenStatus: { type: ['string', 'null'] },
                imageUrl: { type: ['string', 'null'] },
                yoloBox: {
                  type: 'object',
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
  }, uploadSpecimen);

  // Upload an image of a specimen to AWS S3
  fastify.post('/image', {
    schema: {
      consumes: ['multipart/form-data'],
      response: {
        201: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            imageUrl: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, uploadImage);

  // Get images for a specimen (returns binary data)
  fastify.get('/:specimen_id/images', {
    schema: {
      params: {
        type: 'object',
        properties: {
          specimen_id: { type: 'string' }
        }
      },
      response: {
        '4xx': {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        '5xx': {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, getImages);

  // Get image metadata for a specimen
  fastify.get('/:specimen_id/image-metadata', {
    schema: {
      params: {
        type: 'object',
        properties: {
          specimen_id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            hasImage: { type: 'boolean' },
            imageUrl: { type: ['string', 'null'] },
            contentType: { type: ['string', 'null'] },
            filename: { type: ['string', 'null'] }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, getImageMetadata);

  // Trigger ML model inference on an image
  fastify.post('/inference', {
    schema: {
      response: {
        501: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, triggerInference);

  // Get specimen details
  fastify.get('/:specimen_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          specimen_id: { type: 'string' }
        }
      },
      response: {
        200: {
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
  }, getSpecimenDetails);

  // Update specimen data
  fastify.put('/:specimen_id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          specimen_id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          species: { type: 'string' },
          sex: { type: 'string' },
          abdomenStatus: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            specimen: {
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
  }, updateSpecimen);

  done();
} 