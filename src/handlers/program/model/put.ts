import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import sequelize from '../../../db/index';
import { ProgramModel } from '../../../db/models';
import { uploadFileStream, deleteFile } from '../../../services/s3.service';
import {
  buildProgramModelS3Key,
  ensureProgramExists,
  findProgramModelByVersion,
  isValidTfliteUpload,
  MAX_MODEL_FILE_SIZE_BYTES,
  parseModelClassesField,
  programModelResponseSchema,
  serializeProgramModelResponse,
  TFLITE_CONTENT_TYPE,
  validateModelClasses,
} from './common';

export const schema = {
  tags: ['Program Models'],
  description: 'Update model classes and optionally replace the model file for a version',
  params: {
    type: 'object',
    properties: {
      program_id: { type: 'string' },
      version: { type: 'string' },
    },
    required: ['program_id', 'version'],
  },
  body: {
    type: 'object',
    properties: {
      modelClasses: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        model: programModelResponseSchema,
      },
    },
  },
};

interface UpdateFields {
  modelClasses?: string;
}

export async function updateProgramModel(
  request: FastifyRequest<{
    Params: { program_id: string; version: string };
    Body: { modelClasses?: string[] };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const programId = parseInt(request.params.program_id, 10);
    if (isNaN(programId)) {
      return reply.code(400).send({ error: 'Invalid program id' });
    }

    const program = await ensureProgramExists(programId);
    if (!program) {
      return reply.code(404).send({ error: 'Program not found' });
    }

    const programModel = await findProgramModelByVersion(programId, request.params.version);
    if (!programModel) {
      return reply.code(404).send({ error: 'Model version not found' });
    }

    let modelClasses: string[] | undefined;
    let filePart: {
      filename: string;
      mimetype: string;
      toBuffer: () => Promise<Buffer>;
    } | null = null;

    if (request.isMultipart()) {
      const fields: UpdateFields = {};

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (part.fieldname === 'file') {
            filePart = part;
          } else {
            part.file.resume();
          }
          continue;
        }

        if (part.fieldname === 'modelClasses') {
          fields.modelClasses = part.value as string;
        }
      }

      if (fields.modelClasses !== undefined) {
        const parsed = parseModelClassesField(fields.modelClasses);
        if (!parsed) {
          return reply.code(400).send({ error: 'modelClasses must be a JSON array of non-empty strings' });
        }
        modelClasses = parsed;
      }
    } else if (request.body?.modelClasses !== undefined) {
      const parsed = validateModelClasses(request.body.modelClasses);
      if (!parsed) {
        return reply.code(400).send({ error: 'modelClasses must be an array of non-empty strings' });
      }
      modelClasses = parsed;
    }

    if (!modelClasses && !filePart) {
      return reply.code(400).send({ error: 'Provide modelClasses and/or a replacement model file' });
    }

    let fileBuffer: Buffer | null = null;
    let newS3Key: string | null = null;
    const oldS3Key = programModel.s3Key;

    if (filePart) {
      if (!isValidTfliteUpload(filePart.filename, filePart.mimetype)) {
        return reply.code(400).send({ error: 'Only .tflite model files are allowed' });
      }

      fileBuffer = await filePart.toBuffer();
      if (fileBuffer.length === 0) {
        return reply.code(400).send({ error: 'Model file is empty' });
      }
      if (fileBuffer.length > MAX_MODEL_FILE_SIZE_BYTES) {
        return reply.code(400).send({ error: 'Model file exceeds the 100MB size limit' });
      }

      newS3Key = `${buildProgramModelS3Key(programId, programModel.version)}.${Date.now()}.tmp`;
    }

    const transaction = await sequelize.transaction();
    try {
      const updates: Partial<ProgramModel> = {};

      if (modelClasses) {
        updates.modelClasses = modelClasses;
      }

      if (fileBuffer && newS3Key) {
        await uploadFileStream(newS3Key, Readable.from(fileBuffer), TFLITE_CONTENT_TYPE);
        updates.s3Key = newS3Key;
        updates.fileSize = fileBuffer.length;
        updates.fileMd5 = createHash('md5').update(fileBuffer).digest('hex');
      }

      await programModel.update(updates, { transaction });
      await transaction.commit();

      if (fileBuffer && newS3Key) {
        try {
          await deleteFile(oldS3Key);
        } catch (cleanupError) {
          request.log.error(cleanupError, `Failed to delete old model file: ${oldS3Key}`);
        }
      }

      await programModel.reload();

      return reply.send({
        message: 'Model updated successfully',
        model: serializeProgramModelResponse(programModel, { includeDownloadUrl: true }),
      });
    } catch (error) {
      await transaction.rollback();
      if (newS3Key && fileBuffer) {
        try {
          await deleteFile(newS3Key);
        } catch (cleanupError) {
          request.log.error(cleanupError, 'Failed to clean up replacement model after DB error');
        }
      }
      throw error;
    }
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to update program model' });
  }
}
