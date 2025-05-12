import { FastifyRequest, FastifyReply } from 'fastify';
import { uploadFileStream } from '../../services/s3.service';
import { findSpecimen, handleError } from './common';
import { SpecimenImage } from '../../db/models';

export const schema = {
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' }
    }
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        imageId: { type: 'number' },
        imageUrl: { type: 'string' }
      }
    }
  }
};

export async function uploadImage(
  request: FastifyRequest<{ Params: { specimen_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    // Check if the request is multipart
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Request is not multipart' });
    }

    // Get file from form data
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file provided' });
    }

    const { specimen_id } = request.params;

    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Validate file type
    const contentType = data.mimetype;
    if (!contentType.startsWith('image/')) {
      return reply.code(400).send({ error: 'Only image files are allowed' });
    }

    // Generate a unique file name
    const fileExtension = contentType.split('/')[1];
    const fileName = `specimens/${specimen.id}/${Date.now()}.${fileExtension}`;

    // Create a readable stream from the file
    const fileStream = data.file;
    
    // Stream directly to S3 without buffering entire file in memory
    const imageKey = await uploadFileStream(fileName, fileStream, contentType);

    // Create new SpecimenImage record
    const newImage = await SpecimenImage.create({
      specimenId: specimen.id,
      imageKey
    });

    // If there's no current thumbnail
    if (!specimen.thumbnailImageId) {
      // Update specimen to use this as the thumbnail
      await specimen.update({ thumbnailImageId: newImage.id });
    }

    reply.code(201).send({
      message: 'Image uploaded successfully',
      imageId: newImage.id,
      imageUrl: `/specimens/${specimen.specimenId}/images/${newImage.id}`
    });
  } catch (error) {
    handleError(error, request, reply, 'Failed to upload specimen image');
  }
} 