import { FastifyInstance } from 'fastify';
import { 
  createSpecimen,
  getSpecimenList,
  getSpecimenDetails,
  updateSpecimen,
  deleteSpecimen,
  exportSpecimensCSV,
  upload,
  images,
} from '../handlers/specimen';
import fastifyMultipart from '@fastify/multipart';

// Import schemas from handler files
import { schema as createSchema } from '../handlers/specimen/post';
import { schema as getSchema } from '../handlers/specimen/get';
import { schema as updateSchema } from '../handlers/specimen/put';
import { schema as uploadImageSchema } from '../handlers/specimen/images/uploadImage';
import { schema as getImageSchema } from '../handlers/specimen/images/getImage';
import { schema as initiateUploadSchema } from '../handlers/specimen/upload/initiate'
import { schema as appendUploadSchema } from '../handlers/specimen/upload/append'
import { schema as completeUploadSchema } from '../handlers/specimen/upload/complete'
import { schema as getUploadStatusSchema } from '../handlers/specimen/upload/get'
import { schema as getListSchema } from '../handlers/specimen/getList'
import { schema as getUploadListSchema } from '../handlers/specimen/upload/getList'
import { schema as deleteSchema } from '../handlers/specimen/delete';
import { schema as putImageSchema } from '../handlers/specimen/images/putImage';
import { schema as deleteImageSchema } from '../handlers/specimen/images/deleteImage';
import { schema as createImageDataSchema } from '../handlers/specimen/images/data/post';
import { schema as updateImageDataSchema } from '../handlers/specimen/images/data/put';
import { schema as getImageListSchema } from '../handlers/specimen/images/data/getList';
import { schema as getImageDataSchema } from '../handlers/specimen/images/data/get';
import { ExportSpecimensCSVRequest, schema as exportSpecimensCSVSchema } from '../handlers/specimen/export';
import { adminAuthMiddleware } from '../middleware/adminAuth.middleware';
import { flexibleAuthMiddleware } from '../middleware/mobileAuth.middleware';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Register multipart support for file uploads
  fastify.register(fastifyMultipart, { limits: { fileSize: CHUNK_SIZE } });

  // Get all specimens with filters
  fastify.get('/', {
    preHandler: [flexibleAuthMiddleware],
    schema: getListSchema
  }, getSpecimenList as any);

  // Create a new specimen
  fastify.post('/', {
    schema: createSchema
  }, createSpecimen);

  // Get specimen details
  fastify.get('/:specimen_id', {
    preHandler: [flexibleAuthMiddleware],
    schema: getSchema
  }, getSpecimenDetails as any);

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
  }, images.uploadImage);

  // Get a specific specimen image by ID
  fastify.get('/:specimen_id/images/:image_id', {
    schema: getImageSchema
  }, images.getImage);

  // Specimen image endpoints
  fastify.get('/:specimen_id/images', {
    schema: getImageListSchema
  }, images.data.getImageList);

  // Update specimen image metadata
  fastify.put('/:specimen_id/images/:image_id', {
    schema: putImageSchema
  }, images.putImage);

  // Delete specimen image
  fastify.delete('/:specimen_id/images/:image_id', {
    schema: deleteImageSchema
  }, images.deleteImage);

  // Initiate multipart upload
  fastify.post('/:specimen_id/images/uploads', {
    schema: initiateUploadSchema
  }, upload.initiateUpload);

  // Append bytes to upload
  fastify.put('/:specimen_id/images/uploads/:upload_id', {
    schema: appendUploadSchema
  }, upload.appendUpload);

  // Complete multipart upload
  fastify.post('/:specimen_id/images/uploads/:upload_id/complete', {
    schema: completeUploadSchema
  }, upload.completeUpload);

  // Get uploads by specimen
  fastify.get('/:specimen_id/images/uploads', {
    schema: getUploadListSchema
  }, upload.getUploadList);

  // Get upload status
  fastify.get('/:specimen_id/images/uploads/:upload_id', {
    schema: getUploadStatusSchema
  }, upload.getUploadStatus);

  // TUS endpoints for specimen images
  fastify.addContentTypeParser('application/offset+octet-stream', (request, payload, done) => done(null));
  fastify.all('/:specimen_id/images/tus', images.tusHandler);
  fastify.all('/:specimen_id/images/tus/*', images.tusHandler);

  // Specimen image data endpoints
  fastify.get('/:specimen_id/images/data', {
    schema: getImageListSchema
  }, images.data.getImageList);

  fastify.post('/:specimen_id/images/data', {
    schema: createImageDataSchema
  }, images.data.createImageData);

  fastify.get('/:specimen_id/images/data/:image_id', {
    schema: getImageDataSchema
  }, images.data.getImageData);

  fastify.put('/:specimen_id/images/data/:image_id', {
    schema: updateImageDataSchema
  }, images.data.updateImageData);

  done();
} 