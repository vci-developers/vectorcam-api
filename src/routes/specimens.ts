import { FastifyInstance } from 'fastify';
import { 
  createSpecimen,
  getSpecimenDetails,
  updateSpecimen,
  uploadImage,
  getImages,
  getImage,
  initiateUpload,
  appendUpload,
  completeUpload,
} from '../handlers/specimen';
import fastifyMultipart from '@fastify/multipart';

// Import schemas from handler files
import { schema as createSchema } from '../handlers/specimen/post';
import { schema as getSchema } from '../handlers/specimen/get';
import { schema as updateSchema } from '../handlers/specimen/put';
import { schema as uploadImageSchema } from '../handlers/specimen/uploadImage';
import { schema as getImagesSchema } from '../handlers/specimen/getImages';
import { schema as getImageSchema } from '../handlers/specimen/getImage';
import { schema as initiateUploadSchema } from '../handlers/specimen/upload/initiate'
import { schema as appendUploadSchema } from '../handlers/specimen/upload/append'
import { schema as completeUploadSchema } from '../handlers/specimen/upload/complete'


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

  // Get a specific specimen image by ID
  fastify.get('/:specimen_id/images/:image_id', {
    schema: getImageSchema
  }, getImage);

  // Get all specimen images - this must come after the more specific image routes
  fastify.get('/:specimen_id/images', {
    schema: getImagesSchema
  }, getImages);

  // Initiate multipart upload
  fastify.post('/:specimen_id/images/uploads', {
    schema: initiateUploadSchema
  }, initiateUpload);

  // Append bytes to upload
  fastify.put('/:specimen_id/images/uploads/:upload_id', {
    schema: appendUploadSchema
  }, appendUpload);

  // Complete multipart upload
  fastify.post('/:specimen_id/images/uploads/:upload_id/complete', {
    schema: completeUploadSchema
  }, completeUpload);

  done();
} 