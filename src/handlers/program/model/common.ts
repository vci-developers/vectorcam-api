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
    version: { type: 'string' },
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

export function buildProgramModelS3Key(programId: number, version: string): string {
  const sanitizedVersion = version.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `programs/${programId}/models/${sanitizedVersion}.tflite`;
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
    version: programModel.version,
    modelClasses: programModel.modelClasses,
    fileSize: programModel.fileSize,
    fileMd5: programModel.fileMd5,
    createdAt: programModel.createdAt?.getTime?.() ?? null,
    updatedAt: programModel.updatedAt?.getTime?.() ?? null,
  };

  if (options.includeDownloadUrl) {
    response.downloadUrl = `/programs/${programModel.programId}/models/${encodeURIComponent(programModel.version)}/download`;
  }

  return response;
}

export async function findProgramModelByVersion(
  programId: number,
  version: string
): Promise<ProgramModel | null> {
  return ProgramModel.findOne({
    where: { programId, version },
  });
}

export async function resolveCurrentProgramModel(programId: number): Promise<ProgramModel | null> {
  const program = await findProgramById(programId);
  if (!program) {
    return null;
  }

  if (program.modelVersion) {
    return findProgramModelByVersion(programId, program.modelVersion);
  }

  return ProgramModel.findOne({
    where: { programId },
    order: [
      ['updatedAt', 'DESC'],
      ['id', 'DESC'],
    ],
  });
}

export async function ensureProgramExists(programId: number): Promise<Program | null> {
  return findProgramById(programId);
}

export async function validateModelVersionPointer(
  programId: number,
  modelVersion: string
): Promise<boolean> {
  const model = await ProgramModel.findOne({
    where: { programId, version: modelVersion },
  });
  return !!model;
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

export function validateVersionString(version: string): string | null {
  const trimmed = version.trim();
  if (!trimmed) {
    return 'version is required';
  }
  if (trimmed.length > 64) {
    return 'version must be 64 characters or fewer';
  }
  if (trimmed === 'current') {
    return 'version cannot be "current"';
  }
  return null;
}

export async function findLatestProgramModelVersion(programId: number): Promise<string | null> {
  const latest = await ProgramModel.findOne({
    where: { programId },
    order: [
      ['updatedAt', 'DESC'],
      ['id', 'DESC'],
    ],
    attributes: ['version'],
  });
  return latest?.version ?? null;
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

export async function versionAlreadyExists(programId: number, version: string): Promise<boolean> {
  const existing = await ProgramModel.findOne({
    where: {
      programId,
      version: { [Op.eq]: version },
    },
  });
  return !!existing;
}
