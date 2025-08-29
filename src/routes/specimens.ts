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
import { mobileAuthMiddleware } from '../middleware/mobileAuth.middleware';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Register multipart support for file uploads
  fastify.register(fastifyMultipart, { limits: { fileSize: CHUNK_SIZE } });

  // Get all specimens with filters
  fastify.get('/', {
    preHandler: [mobileAuthMiddleware],
    schema: getListSchema
  }, getSpecimenList as any);

  // Create a new specimen
  fastify.post('/', {
    preHandler: [mobileAuthMiddleware],
    schema: createSchema
  }, createSpecimen as any);

  // Get specimen details
  fastify.get('/:specimen_id', {
    preHandler: [mobileAuthMiddleware],
    schema: getSchema
  }, getSpecimenDetails as any);

  // Update specimen
  fastify.put('/:specimen_id', {
    preHandler: [mobileAuthMiddleware],
    schema: updateSchema
  }, updateSpecimen as any);

  // Delete specimen
  fastify.delete('/:specimen_id', {
    preHandler: [mobileAuthMiddleware],
    schema: deleteSchema
  }, deleteSpecimen as any);

  // Export specimens as CSV
  fastify.get<ExportSpecimensCSVRequest>('/export/csv', {
    schema: exportSpecimensCSVSchema,
    preHandler: [adminAuthMiddleware],
  }, exportSpecimensCSV);

  // Upload specimen image
  fastify.post('/:specimen_id/images', {
    preHandler: [mobileAuthMiddleware],
    schema: uploadImageSchema
  }, images.uploadImage as any);

  // Get a specific specimen image by ID
  fastify.get('/:specimen_id/images/:image_id', {
    schema: getImageSchema
  }, images.getImage);

  // Specimen image endpoints
  fastify.get('/:specimen_id/images', {
    preHandler: [mobileAuthMiddleware],
    schema: getImageListSchema
  }, images.data.getImageList as any);

  // Update specimen image metadata
  fastify.put('/:specimen_id/images/:image_id', {
    preHandler: [mobileAuthMiddleware],
    schema: putImageSchema
  }, images.putImage as any);

  // Delete specimen image
  fastify.delete('/:specimen_id/images/:image_id', {
    preHandler: [mobileAuthMiddleware],
    schema: deleteImageSchema
  }, images.deleteImage as any);

  // Initiate multipart upload
  fastify.post('/:specimen_id/images/uploads', {
    preHandler: [mobileAuthMiddleware],
    schema: initiateUploadSchema
  }, upload.initiateUpload as any);

  // Append bytes to upload
  fastify.put('/:specimen_id/images/uploads/:upload_id', {
    preHandler: [mobileAuthMiddleware],
    schema: appendUploadSchema
  }, upload.appendUpload as any);

  // Complete multipart upload
  fastify.post('/:specimen_id/images/uploads/:upload_id/complete', {
    preHandler: [mobileAuthMiddleware],
    schema: completeUploadSchema
  }, upload.completeUpload as any);

  // Get uploads by specimen
  fastify.get('/:specimen_id/images/uploads', {
    preHandler: [mobileAuthMiddleware],
    schema: getUploadListSchema
  }, upload.getUploadList as any);

  // Get upload status
  fastify.get('/:specimen_id/images/uploads/:upload_id', {
    preHandler: [mobileAuthMiddleware],
    schema: getUploadStatusSchema
  }, upload.getUploadStatus as any);

  // TUS endpoints for specimen images
  fastify.addContentTypeParser('application/offset+octet-stream', (request, payload, done) => done(null));
  fastify.all('/:specimen_id/images/tus', images.tusHandler);
  fastify.all('/:specimen_id/images/tus/*', images.tusHandler);

  // Specimen image data endpoints
  fastify.get('/:specimen_id/images/data', {
    preHandler: [mobileAuthMiddleware],
    schema: getImageListSchema
  }, images.data.getImageList as any);

  fastify.post('/:specimen_id/images/data', {
    preHandler: [mobileAuthMiddleware],
    schema: createImageDataSchema
  }, images.data.createImageData as any);

  fastify.get('/:specimen_id/images/data/:image_id', {
    preHandler: [mobileAuthMiddleware],
    schema: getImageDataSchema
  }, images.data.getImageData as any);

  fastify.put('/:specimen_id/images/data/:image_id', {
    preHandler: [mobileAuthMiddleware],
    schema: updateImageDataSchema
  }, images.data.updateImageData as any);

  done();
} 