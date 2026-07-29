import { Op } from 'sequelize';
import { Program, ProgramModel } from '../../../db/models';
import { findProgramById } from '../common';

export const MAX_MODEL_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const TFLITE_CONTENT_TYPE = 'application/octet-stream';

export const programModelResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    programId: { type: 'number' },
    modelId: { type: 'string' },
    filename: { type: 'string' },
    modelClasses: {
      type: 'array',
      items: { type: 'string' },
    },
    fileSize: { type: 'number' },
    fileMd5: { type: 'string' },
    downloadUrl: { type: 'string' },
    createdAt: { type: ['number', 'null'] },
    updatedAt: { type: ['number', 'null'] },
  },
};

export function buildProgramModelS3Key(programId: number, modelId: string): string {
  const sanitizedModelId = modelId.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `programs/${programId}/models/${sanitizedModelId}.tflite`;
}

export function normalizeUploadFilename(filename: string | undefined, modelId: string): string {
  const trimmed = (filename || '').trim();
  if (trimmed) {
    return trimmed.slice(0, 255);
  }
  return `${modelId}.tflite`;
}

export function formatContentDispositionFilename(filename: string): string {
  const sanitized = filename.replace(/[\r\n"]/g, '_');
  return `attachment; filename="${sanitized}"`;
}

export function validateModelClasses(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  if (!value.every(item => typeof item === 'string' && item.trim().length > 0)) {
    return null;
  }

  return value.map(item => item.trim());
}

export function parseModelClassesField(rawValue: string | undefined): string[] | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return validateModelClasses(parsed);
  } catch {
    return null;
  }
}

export function serializeProgramModelResponse(
  programModel: ProgramModel,
  options: { includeDownloadUrl?: boolean } = {}
): Record<string, unknown> {
  const response: Record<string, unknown> = {
    id: programModel.id,
    programId: programModel.programId,
    modelId: programModel.modelId,
    filename: programModel.filename,
    modelClasses: programModel.modelClasses,
    fileSize: programModel.fileSize,
    fileMd5: programModel.fileMd5,
    createdAt: programModel.createdAt?.getTime?.() ?? null,
    updatedAt: programModel.updatedAt?.getTime?.() ?? null,
  };

  if (options.includeDownloadUrl) {
    response.downloadUrl = `/programs/${programModel.programId}/models/${encodeURIComponent(programModel.modelId)}/download`;
  }

  return response;
}

export async function findProgramModelByModelId(
  programId: number,
  modelId: string
): Promise<ProgramModel | null> {
  return ProgramModel.findOne({
    where: { programId, modelId },
  });
}

export async function ensureProgramExists(programId: number): Promise<Program | null> {
  return findProgramById(programId);
}

export function isValidTfliteUpload(
  filename: string | undefined,
  mimetype: string | undefined
): boolean {
  const normalizedFilename = (filename || '').toLowerCase();
  if (normalizedFilename.endsWith('.tflite')) {
    return true;
  }

  const normalizedMime = (mimetype || '').toLowerCase();
  return normalizedMime === TFLITE_CONTENT_TYPE || normalizedMime === 'application/x-tflite';
}

export function validateModelIdString(modelId: string): string | null {
  const trimmed = modelId.trim();
  if (!trimmed) {
    return 'modelId is required';
  }
  if (trimmed.length > 64) {
    return 'modelId must be 64 characters or fewer';
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return 'modelId may only contain letters, numbers, dots, underscores, and hyphens';
  }
  return null;
}

export function validateProgramConfig(value: unknown): Record<string, unknown> | null | 'invalid' {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return 'invalid';
  }
  return value as Record<string, unknown>;
}

export async function listProgramModels(programId: number): Promise<ProgramModel[]> {
  return ProgramModel.findAll({
    where: { programId },
    order: [
      ['updatedAt', 'DESC'],
      ['id', 'DESC'],
    ],
  });
}

export async function modelIdAlreadyExists(programId: number, modelId: string): Promise<boolean> {
  const existing = await ProgramModel.findOne({
    where: {
      programId,
      modelId: { [Op.eq]: modelId },
    },
  });
  return !!existing;
}
