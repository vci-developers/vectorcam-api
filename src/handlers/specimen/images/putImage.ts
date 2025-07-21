import { FastifyRequest, FastifyReply } from 'fastify';
import { SpecimenImage, InferenceResult } from '../../../db/models';
import { findSpecimen, handleError } from '../common';
import { uploadFileStream } from '../../../services/s3.service';
import { createHash } from 'crypto';
import { Readable } from 'stream';

export const schema = {
  tags: ['Specimen Images'],
  description: 'Replace a specimen image file',
  consumes: ['multipart/form-data'],
  params: {
    type: 'object',
    properties: {
      specimen_id: { type: 'string' },
      image_id: { type: 'number' }
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
                    speciesProbabilities: { type: 'array', items: { type: 'number' } },
                    sexProbabilities: { type: 'array', items: { type: 'number' } },
                    abdomenStatusProbabilities: { type: 'array', items: { type: 'number' } }
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
    imageKey = await uploadFileStream(fileName, fileStream, contentType);

    // Find the specimen
    const specimen = await findSpecimen(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    // Find the image
    const image = await SpecimenImage.findOne({ where: { id: image_id, specimenId: specimen.id } });
    if (!image) {
      return reply.code(404).send({ error: 'Image not found' });
    }

    // Update image record with new file info only
    await image.update({
      imageKey,
      filemd5: md5Hash
    });

    await specimen.update({ thumbnailImageId: image.id });

    // Get inference result if exists
    let result = await InferenceResult.findOne({ where: { specimenImageId: image.id } });

    // Build the updated image object for response
    const updatedImage = {
      id: image.id,
      url: `/specimens/${specimen.specimenId || specimen.id}/images/${image.id}`,
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
        speciesProbabilities: JSON.parse(result.speciesProbabilities),
        sexProbabilities: JSON.parse(result.sexProbabilities),
        abdomenStatusProbabilities: JSON.parse(result.abdomenStatusProbabilities)
      } : null,
      filemd5: image.filemd5
    };

    return reply.send({ message: 'Image file replaced successfully', image: updatedImage });
  } catch (error) {
    return handleError(error, request, reply, 'Failed to update specimen image');
  }
} 