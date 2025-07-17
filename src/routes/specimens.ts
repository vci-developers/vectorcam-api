import { FastifyInstance } from 'fastify';
import { 
  createSpecimen,
  getSpecimenDetails,
  updateSpecimen,
  uploadImage,
  getImages,
  getImage,
  getImageInfo,
  putImage,
  deleteImage,
  initiateUpload,
  appendUpload,
  completeUpload,
  getUploadStatus,
  deleteSpecimen,
  exportSpecimensCSV,
} from '../handlers/specimen';
import { getSpecimenList } from '../handlers/specimen/getList';
import { getUploadList } from '../handlers/specimen/upload/getList';
import { tusHandler } from '../handlers/specimen/images/tusServer';
import fastifyMultipart from '@fastify/multipart';

// Import schemas from handler files
import { schema as createSchema } from '../handlers/specimen/post';
import { schema as getSchema } from '../handlers/specimen/get';
import { schema as updateSchema } from '../handlers/specimen/put';
import { schema as uploadImageSchema } from '../handlers/specimen/images/uploadImage';
import { schema as getImagesSchema } from '../handlers/specimen/images/getImages';
import { schema as getImageSchema, infoSchema as getImageInfoSchema } from '../handlers/specimen/images/getImage';
import { schema as initiateUploadSchema } from '../handlers/specimen/upload/initiate'
import { schema as appendUploadSchema } from '../handlers/specimen/upload/append'
import { schema as completeUploadSchema } from '../handlers/specimen/upload/complete'
import { schema as getUploadStatusSchema } from '../handlers/specimen/upload/get'
import { schema as getListSchema } from '../handlers/specimen/getList'
import { schema as getUploadListSchema } from '../handlers/specimen/upload/getList'
import { schema as deleteSchema } from '../handlers/specimen/delete';
import { schema as putImageSchema } from '../handlers/specimen/images/putImage';
import { schema as deleteImageSchema } from '../handlers/specimen/images/deleteImage';
import { ExportSpecimensCSVRequest, schema as exportSpecimensCSVSchema } from '../handlers/specimen/export';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Register multipart support for file uploads
  fastify.register(fastifyMultipart, { limits: { fileSize: CHUNK_SIZE } });

  // Get all specimens with filters
  fastify.get('/', {
    schema: getListSchema
  }, getSpecimenList);

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

  // Delete specimen
  fastify.delete('/:specimen_id', {
    schema: deleteSchema
  }, deleteSpecimen);

  // Export specimens as CSV
  fastify.get<ExportSpecimensCSVRequest>('/export/csv', {
    schema: exportSpecimensCSVSchema,
    preHandler: [adminAuthMiddleware],
  }, exportSpecimensCSV);

  // Upload specimen image
  fastify.post('/:specimen_id/images', {
    schema: uploadImageSchema
  }, uploadImage);

  // Get a specific specimen image by ID
  fastify.get('/:specimen_id/images/:image_id', {
    schema: getImageSchema
  }, getImage);

  // Get image info (metadata only)
  fastify.get('/:specimen_id/images/:image_id/info', {
    schema: getImageInfoSchema
  }, getImageInfo);

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

  // Get uploads by specimen
  fastify.get('/:specimen_id/images/uploads', {
    schema: getUploadListSchema
  }, getUploadList);

  // Get upload status
  fastify.get('/:specimen_id/images/uploads/:upload_id', {
    schema: getUploadStatusSchema
  }, getUploadStatus);

  // Update specimen image metadata
  fastify.put('/:specimen_id/images/:image_id', {
    schema: putImageSchema
  }, putImage);

  // Delete specimen image
  fastify.delete('/:specimen_id/images/:image_id', {
    schema: deleteImageSchema
  }, deleteImage);

  // TUS endpoints for specimen images
  fastify.addContentTypeParser('application/offset+octet-stream', (request, payload, done) => done(null));
  fastify.all('/:specimen_id/images/tus', tusHandler);
  fastify.all('/:specimen_id/images/tus/*', tusHandler);

  done();
} 