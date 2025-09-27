import { FastifyInstance } from 'fastify';
import { 
  createSpecimen,
  getSpecimenList,
  getSpecimenCount,
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
import { schema as getCountSchema } from '../handlers/specimen/getCount'
import { schema as getUploadListSchema } from '../handlers/specimen/upload/getList'
import { schema as deleteSchema } from '../handlers/specimen/delete';
import { schema as putImageSchema } from '../handlers/specimen/images/putImage';
import { schema as deleteImageSchema } from '../handlers/specimen/images/deleteImage';
import { schema as createImageDataSchema } from '../handlers/specimen/images/data/post';
import { schema as updateImageDataSchema } from '../handlers/specimen/images/data/put';
import { schema as getImageListSchema } from '../handlers/specimen/images/data/getList';
import { schema as getImageDataSchema } from '../handlers/specimen/images/data/get';
import { ExportSpecimensCSVRequest, schema as exportSpecimensCSVSchema } from '../handlers/specimen/export';
import { requireAdminAuth } from '../middleware/auth.middleware';
import { 
  siteAccessMiddleware,
  requireSiteReadAccess,
  requireSiteWriteAccess
} from '../middleware/siteAccess.middleware';
import {
  requireSpecificSpecimenReadAccess,
  requireSpecificSpecimenWriteAccess
} from '../middleware/specimenAccess.middleware';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

export default function (fastify: FastifyInstance, opts: object, done: () => void): void {
  // Register multipart support for file uploads
  fastify.register(fastifyMultipart, { limits: { fileSize: CHUNK_SIZE } });

  // Register site access middleware for all routes
  fastify.addHook('preHandler', siteAccessMiddleware);

  // Get all specimens with filters (requires read access)
  fastify.get('/', {
    preHandler: [requireSiteReadAccess],
    schema: getListSchema
  }, getSpecimenList as any);

  // Get specimen counts grouped by thumbnail image metadata (requires read access)
  fastify.get('/count', {
    preHandler: [requireSiteReadAccess],
    schema: getCountSchema
  }, getSpecimenCount as any);

  // Create a new specimen (requires write access, session validation in handler)
  fastify.post('/', {
    preHandler: [requireSiteWriteAccess],
    schema: createSchema
  }, createSpecimen as any);

  // Get specimen details (requires access to specific specimen)
  fastify.get('/:specimen_id', {
    preHandler: [requireSpecificSpecimenReadAccess],
    schema: getSchema
  }, getSpecimenDetails as any);

  // Update specimen (requires write access to specific specimen)
  fastify.put('/:specimen_id', {
    preHandler: [requireSpecificSpecimenWriteAccess],
    schema: updateSchema
  }, updateSpecimen as any);

  // Delete specimen (requires write access to specific specimen)
  fastify.delete('/:specimen_id', {
    preHandler: [requireSpecificSpecimenWriteAccess],
    schema: deleteSchema
  }, deleteSpecimen as any);

  // Export specimens as CSV
  fastify.get<ExportSpecimensCSVRequest>('/export/csv', {
    schema: exportSpecimensCSVSchema,
    preHandler: [requireAdminAuth],
  }, exportSpecimensCSV);

  // Upload specimen image (requires write access to specific specimen)
  fastify.post('/:specimen_id/images', {
    preHandler: [requireSpecificSpecimenWriteAccess],
    schema: uploadImageSchema
  }, images.uploadImage as any);

  // Get a specific specimen image by ID (skip access control)
  fastify.get('/:specimen_id/images/:image_id', {
    schema: getImageSchema
  }, images.getImage);

  // Specimen image endpoints (requires read access to specific specimen)
  fastify.get('/:specimen_id/images', {
    preHandler: [requireSpecificSpecimenReadAccess],
    schema: getImageListSchema
  }, images.data.getImageList as any);

  // Update specimen image metadata (requires write access to specific specimen)
  fastify.put('/:specimen_id/images/:image_id', {
    preHandler: [requireSpecificSpecimenWriteAccess],
    schema: putImageSchema
  }, images.putImage as any);

  // Delete specimen image (requires write access to specific specimen)
  fastify.delete('/:specimen_id/images/:image_id', {
    preHandler: [requireSpecificSpecimenWriteAccess],
    schema: deleteImageSchema
  }, images.deleteImage as any);

  // Initiate multipart upload (requires write access to specific specimen)
  fastify.post('/:specimen_id/images/uploads', {
    preHandler: [requireSpecificSpecimenWriteAccess],
    schema: initiateUploadSchema
  }, upload.initiateUpload as any);

  // Append bytes to upload (requires write access to specific specimen)
  fastify.put('/:specimen_id/images/uploads/:upload_id', {
    preHandler: [requireSpecificSpecimenWriteAccess],
    schema: appendUploadSchema
  }, upload.appendUpload as any);

  // Complete multipart upload (requires write access to specific specimen)
  fastify.post('/:specimen_id/images/uploads/:upload_id/complete', {
    preHandler: [requireSpecificSpecimenWriteAccess],
    schema: completeUploadSchema
  }, upload.completeUpload as any);

  // Get uploads by specimen (requires read access to specific specimen)
  fastify.get('/:specimen_id/images/uploads', {
    preHandler: [requireSpecificSpecimenReadAccess],
    schema: getUploadListSchema
  }, upload.getUploadList as any);

  // Get upload status (requires read access to specific specimen)
  fastify.get('/:specimen_id/images/uploads/:upload_id', {
    preHandler: [requireSpecificSpecimenReadAccess],
    schema: getUploadStatusSchema
  }, upload.getUploadStatus as any);

  // TUS endpoints for specimen images (skip access control)
  fastify.addContentTypeParser('application/offset+octet-stream', (request, payload, done) => done(null));
  fastify.all('/:specimen_id/images/tus', images.tusHandler);
  fastify.all('/:specimen_id/images/tus/*', images.tusHandler);

  // Specimen image data endpoints (requires read access to specific specimen)
  fastify.get('/:specimen_id/images/data', {
    preHandler: [requireSpecificSpecimenReadAccess],
    schema: getImageListSchema
  }, images.data.getImageList as any);

  // Create image data (requires write access to specific specimen)
  fastify.post('/:specimen_id/images/data', {
    preHandler: [requireSpecificSpecimenWriteAccess],
    schema: createImageDataSchema
  }, images.data.createImageData as any);

  // Get specific image data (requires read access to specific specimen)
  fastify.get('/:specimen_id/images/data/:image_id', {
    preHandler: [requireSpecificSpecimenReadAccess],
    schema: getImageDataSchema
  }, images.data.getImageData as any);

  // Update image data (requires write access to specific specimen)
  fastify.put('/:specimen_id/images/data/:image_id', {
    preHandler: [requireSpecificSpecimenWriteAccess],
    schema: updateImageDataSchema
  }, images.data.updateImageData as any);

  done();
} 