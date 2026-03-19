import { FastifyRequest, FastifyReply } from 'fastify';
import { SpecimenImage, InferenceResult, Specimen, Session } from '../../../db/models';
import { handleError, findSpecimenImage, parseProbabilityString } from '../common';
import { uploadFileStream } from '../../../services/s3.service';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { getChangedFields, logReviewAction } from '../../../services/reviewActionLog.service';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Replace a specimen image file',
  consumes: ['multipart/form-data'],
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'number' },
      image_id: { type: 'string' }
    },
    required: ['specimen_id', 'image_id']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        image: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            url: { type: 'string' },
            metadata: { type: ['object', 'null'], additionalProperties: true },
            species: { type: ['string', 'null'] },
            sex: { type: ['string', 'null'] },
            abdomenStatus: { type: ['string', 'null'] },
            capturedAt: { type: ['number', 'null'] },
            submittedAt: { type: 'number' },
            inferenceResult: {
              anyOf: [
                { type: 'null' },
                {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    bboxTopLeftX: { type: 'number' },
                    bboxTopLeftY: { type: 'number' },
                    bboxWidth: { type: 'number' },
                    bboxHeight: { type: 'number' },
                    bboxConfidence: { type: 'number' },
                    bboxClassId: { type: 'number' },
                    speciesLogits: { type: 'array', items: { type: 'number' } },
                    sexLogits: { type: 'array', items: { type: 'number' } },
                    abdomenStatusLogits: { type: 'array', items: { type: 'number' } },
                    speciesInferenceDuration: { type: ['number', 'null'] },
                    sexInferenceDuration: { type: ['number', 'null'] },
                    abdomenStatusInferenceDuration: { type: ['number', 'null'] },
                    bboxDetectionDuration: { type: ['number', 'null'] }
                  }
                }
              ]
            },
            filemd5: { type: 'string' }
          }
        }
      }
    }
  }
};

export async function putImage(
  request: FastifyRequest<{ Params: { specimen_id: string; image_id: number } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id, image_id } = request.params;
    let fileData, fileBuffer, contentType, fileExtension, md5Hash, fileName, fileStream, imageKey;

    if (!(request.isMultipart && request.isMultipart())) {
      return reply.code(400).send({ error: 'Request must be multipart/form-data with a file' });
    }

    // Parse all parts
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        fileData = part;
        break;
      }
    }

    if (!fileData) {
      return reply.code(400).send({ error: 'No file provided' });
    }

    contentType = fileData.mimetype;
    if (!contentType.startsWith('image/')) {
      return reply.code(400).send({ error: 'Only image files are allowed' });
    }
    fileExtension = contentType.split('/')[1];
    fileBuffer = await fileData.toBuffer();
    md5Hash = createHash('md5').update(fileBuffer).digest('hex');
    fileName = `specimens/${specimen_id}/${md5Hash}.${fileExtension}`;
    fileStream = Readable.from(fileBuffer);

    // Find the specimen
    const specimen = await Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Find the image
    const image = await findSpecimenImage(specimen.id, image_id);
    if (!image) {
      return reply.code(404).send({ error: 'Image not found' });
    }

    const beforeImageState: Record<string, unknown> = {
      imageKey: image.imageKey,
      filemd5: image.filemd5,
    };
    const beforeSpecimenState: Record<string, unknown> = {
      thumbnailImageId: specimen.thumbnailImageId,
    };

    // If the uploaded file's md5 does not match the current filemd5, abort
    if (image.filemd5 && md5Hash !== image.filemd5) {
      return reply.code(400).send({ error: 'Uploaded image filemd5 does not match the existing image filemd5' });
    }

    // Only upload if md5 matches
    imageKey = await uploadFileStream(fileName, fileStream, contentType);

    // Update image record with new file info only
    await image.update({
      imageKey,
      filemd5: md5Hash
    });

    await specimen.update({ thumbnailImageId: image.id });

    const imageChanges = getChangedFields(beforeImageState, {
      imageKey: image.imageKey,
      filemd5: image.filemd5,
    });
    const specimenChanges = getChangedFields(beforeSpecimenState, {
      thumbnailImageId: specimen.thumbnailImageId,
    });

    const session = await Session.findByPk(specimen.sessionId);
    if (session) {
      const reviewDate = session.collectionDate || session.createdAt || new Date();
      const userId = (request as any).user?.id || null;
      const combinedChanges: Record<string, unknown> = {};
      if (Object.keys(imageChanges).length > 0) {
        combinedChanges.image = imageChanges;
      }
      if (Object.keys(specimenChanges).length > 0) {
        combinedChanges.specimen = specimenChanges;
      }

      try {
        await logReviewAction({
          siteId: session.siteId,
          year: reviewDate.getFullYear(),
          month: reviewDate.getMonth() + 1,
          action: 'replace_specimen_image_file',
          userId,
          changes: combinedChanges,
          fields: {
            endpoint: '/specimens/:specimen_id/images/:image_id',
            httpMethod: 'PUT',
            entityType: 'specimen_image',
            entityId: image.id,
            sessionId: session.id,
            specimenId: specimen.id,
            imageId: image.id,
          },
          metadata: {
            contentType,
            bodyType: 'multipart/form-data',
          },
        });
      } catch (logError) {
        request.log.error({ err: logError, imageId: image.id }, 'Failed to write review action log');
      }
    }

    // Get inference result if exists
    let result = await InferenceResult.findOne({ where: { specimenImageId: image.id } });

    // Build the updated image object for response
    const updatedImage = {
      id: image.id,
      url: `/specimens/${specimen.id}/images/${image.id}`,
      metadata: image.metadata ?? null,
      species: image.species,
      sex: image.sex,
      abdomenStatus: image.abdomenStatus,
      capturedAt: image.capturedAt ? image.capturedAt.getTime() : null,
      submittedAt: image.createdAt.getTime(),
      inferenceResult: result ? {
        id: result.id,
        bboxTopLeftX: result.bboxTopLeftX,
        bboxTopLeftY: result.bboxTopLeftY,
        bboxWidth: result.bboxWidth,
        bboxHeight: result.bboxHeight,
        bboxConfidence: result.bboxConfidence,
        bboxClassId: result.bboxClassId,
        speciesLogits: parseProbabilityString(result.speciesLogits),
        sexLogits: parseProbabilityString(result.sexLogits),
        abdomenStatusLogits: parseProbabilityString(result.abdomenStatusLogits),
        speciesInferenceDuration: result.speciesInferenceDuration,
        sexInferenceDuration: result.sexInferenceDuration,
        abdomenStatusInferenceDuration: result.abdomenStatusInferenceDuration,
        bboxDetectionDuration: result.bboxDetectionDuration
      } : null,
      filemd5: image.filemd5
    };

    return reply.send({ message: 'Image file replaced successfully', image: updatedImage });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to update specimen image');
  }
} 