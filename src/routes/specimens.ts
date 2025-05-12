import { FastifyInstance } from 'fastify';
import { 
  createSpecimen,
  getSpecimenDetails,
  updateSpecimen,
  uploadImage,
  getImages,
  getImageMetadata
} from '../handlers/specimen';
import fastifyMultipart from '@fastify/multipart';

// Import schemas from handler files
import { schema as createSchema } from '../handlers/specimen/post';
import { schema as getSchema } from '../handlers/specimen/get';
import { schema as updateSchema } from '../handlers/specimen/put';
import { schema as uploadImageSchema } from '../handlers/specimen/uploadImage';
import { schema as getImagesSchema } from '../handlers/specimen/getImages';
import { schema as getImageMetadataSchema } from '../handlers/specimen/getImageMetadata';

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Register multipart support for file uploads
  fastify.register(fastifyMultipart);

  // Create a new specimen
  fastify.post('/', {
    schema: createSchema
  }, createSpecimen);

  // Get specimen details
  fastify.get('/:specimen_id', {
    schema: getSchema
  }, getSpecimenDetails);

  // Update specimen
  fastify.put('/:specimen_id', {
    schema: updateSchema
  }, updateSpecimen);

  // Upload specimen image
  fastify.post('/:specimen_id/images', {
    schema: uploadImageSchema
  }, uploadImage);

  // Get specimen image
  fastify.get('/:specimen_id/images', {
    schema: getImagesSchema
  }, getImages);

  // Get specimen image metadata
  fastify.get('/:specimen_id/images/metadata', {
    schema: getImageMetadataSchema
  }, getImageMetadata);

  done();
} 