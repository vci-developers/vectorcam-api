import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import sequelize from '../../../db/index';
import { ProgramModel } from '../../../db/models';
import { uploadFileStream, deleteFile } from '../../../services/s3.service';
import {
  buildProgramModelS3Key,
  ensureProgramExists,
  isValidTfliteUpload,
  MAX_MODEL_FILE_SIZE_BYTES,
  modelIdAlreadyExists,
  parseModelClassesField,
  programModelResponseSchema,
  serializeProgramModelResponse,
  TFLITE_CONTENT_TYPE,
  validateModelIdString,
} from './common';

export const schema = {
  tags: ['Program Models'],
  description: 'Upload a new ML model for a program. modelId is a uploader-chosen identifier unique within the program.',
  consumes: ['multipart/form-data'],
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
    },
    required: ['program_id'],
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        model: programModelResponseSchema,
      },
    },
  },
};

interface UploadFields {
  modelId?: string;
  modelClasses?: string;
}

export async function uploadProgramModel(
  request: FastifyRequest<{ Params: { program_id: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Request must be multipart/form-data' });
    }

    const programId = parseInt(request.params.program_id, 10);
    if (isNaN(programId)) {
      return reply.code(400).send({ error: 'Invalid program id' });
    }

    const program = await ensureProgramExists(programId);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const fields: UploadFields = {};
    let filePart: {
      filename: string;
      mimetype: string;
      toBuffer: () => Promise<Buffer>;
    } | null = null;

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        if (part.fieldname === 'file') {
          filePart = part;
        } else {
          part.file.resume();
        }
        continue;
      }

      if (part.fieldname === 'modelId') {
        fields.modelId = part.value as string;
      } else if (part.fieldname === 'modelClasses') {
        fields.modelClasses = part.value as string;
      }
    }

    if (!filePart) {
      return reply.code(400).send({ error: 'No model file provided' });
    }

    const modelId = fields.modelId?.trim();
    if (!modelId) {
      return reply.code(400).send({ error: 'modelId is required' });
    }

    const modelIdError = validateModelIdString(modelId);
    if (modelIdError) {
      return reply.code(400).send({ error: modelIdError });
    }

    const modelClasses = parseModelClassesField(fields.modelClasses);
    if (!modelClasses) {
      return reply.code(400).send({ error: 'modelClasses must be a JSON array of non-empty strings' });
    }

    if (!isValidTfliteUpload(filePart.filename, filePart.mimetype)) {
      return reply.code(400).send({ error: 'Only .tflite model files are allowed' });
    }

    const fileBuffer = await filePart.toBuffer();
    if (fileBuffer.length === 0) {
      return reply.code(400).send({ error: 'Model file is empty' });
    }
    if (fileBuffer.length > MAX_MODEL_FILE_SIZE_BYTES) {
      return reply.code(400).send({ error: 'Model file exceeds the 100MB size limit' });
    }

    if (await modelIdAlreadyExists(programId, modelId)) {
      return reply.code(409).send({ error: 'A model with this modelId already exists for this program' });
    }

    const fileMd5 = createHash('md5').update(fileBuffer).digest('hex');
    const s3Key = buildProgramModelS3Key(programId, modelId);

    const transaction = await sequelize.transaction();
    try {
      await uploadFileStream(s3Key, Readable.from(fileBuffer), TFLITE_CONTENT_TYPE);

      const programModel = await ProgramModel.create(
        {
          programId,
          modelId,
          s3Key,
          modelClasses,
          fileSize: fileBuffer.length,
          fileMd5,
        },
        { transaction }
      );

      await transaction.commit();

      return reply.code(201).send({
        message: 'Model uploaded successfully',
        model: serializeProgramModelResponse(programModel, { includeDownloadUrl: true }),
      });
    } catch (error) {
      await transaction.rollback();
      try {
        await deleteFile(s3Key);
      } catch (cleanupError) {
        request.log.error(cleanupError, 'Failed to clean up uploaded model after DB error');
      }
      throw error;
    }
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to upload program model' });
  }
}
