import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { models } from '../../db';
import { getFile, getFileStream, uploadFileStream } from '../../services/s3.service';

interface UploadSpecimenRequest {
  specimenId: string;
  sessionId: string;
  species?: string;
  sex?: string;
  abdomenStatus?: string;
  yoloBox: {
    topLeftX: number;
    topLeftY: number;
    width: number;
    height: number;
  };
}

interface UpdateSpecimenRequest {
  species?: string;
  sex?: string;
  abdomenStatus?: string;
}

export async function uploadSpecimen(
  request: FastifyRequest<{ Body: UploadSpecimenRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimenId, sessionId, species, sex, abdomenStatus, yoloBox } = request.body;

    // Check if session exists
    const session = await models.Session.findByPk(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // Generate a unique yoloBox ID with 'YB' prefix
    const yoloBoxId = `YB${uuidv4().replace(/-/g, '').substring(0, 12)}`;

    // Create YoloBox entry
    const createdYoloBox = await models.YoloBox.create({
      id: yoloBoxId,
      topLeftX: yoloBox.topLeftX,
      topLeftY: yoloBox.topLeftY,
      width: yoloBox.width,
      height: yoloBox.height,
    });

    // Create Specimen
    const specimen = await models.Specimen.create({
      id: specimenId,
      sessionId,
      yoloBoxId: createdYoloBox.id,
      species,
      sex,
      abdomenStatus,
    });

    reply.code(201).send({
      message: 'Specimen data uploaded successfully',
      specimen: {
        specimenId: specimen.id,
        sessionId: specimen.sessionId,
        species: specimen.species,
        sex: specimen.sex,
        abdomenStatus: specimen.abdomenStatus,
        imageUrl: specimen.imageUrl ? `/specimens/${specimen.id}/images` : null,
        yoloBox: {
          yoloBoxId: createdYoloBox.id,
          topLeftX: createdYoloBox.topLeftX,
          topLeftY: createdYoloBox.topLeftY,
          width: createdYoloBox.width,
          height: createdYoloBox.height,
        },
      },
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to upload specimen data' });
  }
}

export async function uploadImage(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Check if the request is multipart
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Request is not multipart' });
    }

    // Get specimenId from form data
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file provided' });
    }

    // Extract specimenId from fields
    const specimenIdField = data.fields.specimenId;
    if (!specimenIdField || !('value' in specimenIdField)) {
      return reply.code(400).send({ error: 'No specimenId provided' });
    }
    
    const specimenId = specimenIdField.value as string;

    // Check if specimen exists
    const specimen = await models.Specimen.findByPk(specimenId);
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
    const fileName = `specimens/${specimenId}/${uuidv4()}.${fileExtension}`;

    // Create a readable stream from the file
    const fileStream = data.file;
    
    // Stream directly to S3 without buffering entire file in memory
    const imagePath = await uploadFileStream(fileName, fileStream, contentType);

    // Update specimen with image path
    await specimen.update({ imageUrl: imagePath });

    reply.code(201).send({
      message: 'Image uploaded successfully',
      imageUrl: `/specimens/${specimen.id}/images`,
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to upload specimen image' });
  }
}

export async function getImages(
  request: FastifyRequest<{ Params: { specimen_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;

    const specimen = await models.Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // If the specimen has no image, return empty array
    if (!specimen.imageUrl) {
      return reply.code(404).send({ error: 'No image found for this specimen' });
    }

    // The imageUrl now contains just the S3 key
    const key = specimen.imageUrl;
    
    try {
      // Get the file stream and content type from S3
      const { stream, contentType } = await getFileStream(key);
      
      // Set appropriate headers
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=3600');
      
      // Pipe the stream to the response using Fastify's send method
      return reply.send(stream);
      
    } catch (error) {
      // If the file doesn't exist in S3, return error
      request.log.error(`Failed to get image from S3: ${key}`, error);
      reply.code(404).send({ error: 'Image not found' });
    }
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to get specimen images' });
  }
}

export async function triggerInference(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // This would typically trigger a machine learning model
    // Since we don't have the actual implementation yet, we'll just provide a placeholder
    reply.code(501).send({ error: 'ML model inference not implemented yet' });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to trigger ML model inference' });
  }
}

export async function getSpecimenDetails(
  request: FastifyRequest<{ Params: { specimen_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;

    const specimen = await models.Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Get YoloBox data
    const yoloBox = await models.YoloBox.findByPk(specimen.yoloBoxId);
    
    reply.send({
      specimenId: specimen.id,
      sessionId: specimen.sessionId,
      species: specimen.species,
      sex: specimen.sex,
      abdomenStatus: specimen.abdomenStatus,
      imageUrl: specimen.imageUrl ? `/specimens/${specimen.id}/images` : null,
      yoloBox: yoloBox ? {
        yoloBoxId: yoloBox.id,
        topLeftX: yoloBox.topLeftX,
        topLeftY: yoloBox.topLeftY,
        width: yoloBox.width,
        height: yoloBox.height,
      } : null,
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to get specimen details' });
  }
}

export async function updateSpecimen(
  request: FastifyRequest<{ Params: { specimen_id: string }; Body: UpdateSpecimenRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;
    const { species, sex, abdomenStatus } = request.body;

    const specimen = await models.Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Update the specimen
    await specimen.update({
      species: species !== undefined ? species : specimen.species,
      sex: sex !== undefined ? sex : specimen.sex,
      abdomenStatus: abdomenStatus !== undefined ? abdomenStatus : specimen.abdomenStatus,
    });

    // Get YoloBox data
    const yoloBox = await models.YoloBox.findByPk(specimen.yoloBoxId);

    reply.send({
      message: 'Specimen updated successfully',
      specimen: {
        specimenId: specimen.id,
        sessionId: specimen.sessionId,
        species: specimen.species,
        sex: specimen.sex,
        abdomenStatus: specimen.abdomenStatus,
        imageUrl: specimen.imageUrl ? `/specimens/${specimen.id}/images` : null,
        yoloBox: yoloBox ? {
          yoloBoxId: yoloBox.id,
          topLeftX: yoloBox.topLeftX,
          topLeftY: yoloBox.topLeftY,
          width: yoloBox.width,
          height: yoloBox.height,
        } : null,
      },
    });
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to update specimen' });
  }
}

export async function getImageMetadata(
  request: FastifyRequest<{ Params: { specimen_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id } = request.params;

    const specimen = await models.Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // If the specimen has no image, return empty object
    if (!specimen.imageUrl) {
      return reply.send({ hasImage: false });
    }

    // The imageUrl now contains just the S3 key
    const key = specimen.imageUrl;
    
    try {
      // Just check if the file exists
      await getFile(key);
      
      // Determine content type based on file extension
      const fileExtension = key.split('.').pop()?.toLowerCase() || '';
      let contentType = 'application/octet-stream';
      
      if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
        contentType = 'image/jpeg';
      } else if (fileExtension === 'png') {
        contentType = 'image/png';
      } else if (fileExtension === 'gif') {
        contentType = 'image/gif';
      } else if (fileExtension === 'webp') {
        contentType = 'image/webp';
      }
      
      reply.send({
        hasImage: true,
        contentType,
        imageUrl: specimen.imageUrl ? `/specimens/${specimen.id}/images` : null,
        filename: key.split('/').pop() || ''
      });
    } catch (error) {
      // If the file doesn't exist in S3
      request.log.error(`Failed to get image from S3: ${key}`, error);
      reply.send({ hasImage: false });
    }
  } catch (error) {
    request.log.error(error);
    reply.code(500).send({ error: 'Failed to get specimen image metadata' });
  }
} 