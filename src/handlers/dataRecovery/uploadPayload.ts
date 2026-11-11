export type DataRecoveryUploadState =
  | 'pending'
  | 'in_progress'
  | 'uploaded'
  | 'failed';

export interface DataRecoveryUploadInfo {
  state: DataRecoveryUploadState;
  filemd5?: string;
  s3Key?: string;
  s3Bucket?: string;
  tusUploadId?: string;
  contentType?: string;
  uploadedAt?: number;
  bytes?: number;
  failureReason?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getUploadInfoFromPayload(payload: unknown): DataRecoveryUploadInfo | null {
  if (!isRecord(payload) || !isRecord(payload.upload)) {
    return null;
  }
  const upload = payload.upload;
  const state = upload.state;
  if (
    state !== 'pending' &&
    state !== 'in_progress' &&
    state !== 'uploaded' &&
    state !== 'failed'
  ) {
    return null;
  }
  return {
    state,
    filemd5: typeof upload.filemd5 === 'string' ? upload.filemd5 : undefined,
    s3Key: typeof upload.s3Key === 'string' ? upload.s3Key : undefined,
    s3Bucket: typeof upload.s3Bucket === 'string' ? upload.s3Bucket : undefined,
    tusUploadId: typeof upload.tusUploadId === 'string' ? upload.tusUploadId : undefined,
    contentType: typeof upload.contentType === 'string' ? upload.contentType : undefined,
    uploadedAt: typeof upload.uploadedAt === 'number' ? upload.uploadedAt : undefined,
    bytes: typeof upload.bytes === 'number' ? upload.bytes : undefined,
    failureReason: typeof upload.failureReason === 'string' ? upload.failureReason : undefined,
  };
}

export function mergeDataRecoveryUploadPayload(
  existing: unknown,
  upload: Partial<DataRecoveryUploadInfo>
): Record<string, unknown> {
  const base: Record<string, unknown> = isRecord(existing) ? { ...existing } : { value: existing };
  const prevUpload = isRecord(base.upload) ? { ...(base.upload as Record<string, unknown>) } : {};
  base.upload = { ...prevUpload, ...upload };
  return base;
}

export function isRecoveryUploadComplete(payload: unknown, filemd5: string): boolean {
  const info = getUploadInfoFromPayload(payload);
  return info?.state === 'uploaded' && info.filemd5 === filemd5 && !!info.s3Key;
}

export interface FinalizeUploadInput {
  payload: unknown;
  status: string;
  tusUploadId: string;
  s3Key: string;
  s3Bucket: string;
  filemd5: string;
  contentType?: string;
  bytes?: number | null;
}

export interface FinalizeUploadResult {
  nextPayload: Record<string, unknown>;
  nextStatus: string;
  duplicate: boolean;
}

/**
 * Merge a successful TUS finish into the recovery row. Idempotent when the same filemd5 is already uploaded.
 */
export function finalizeDataRecoveryUpload(input: FinalizeUploadInput): FinalizeUploadResult {
  const { filemd5, s3Key, s3Bucket, tusUploadId, contentType, bytes } = input;

  if (isRecoveryUploadComplete(input.payload, filemd5)) {
    return {
      nextPayload: isRecord(input.payload) ? { ...input.payload } : { value: input.payload },
      nextStatus: 'uploaded',
      duplicate: true,
    };
  }

  const nextPayload = mergeDataRecoveryUploadPayload(input.payload, {
    state: 'uploaded',
    filemd5,
    s3Key,
    s3Bucket,
    tusUploadId,
    contentType,
    uploadedAt: Date.now(),
    bytes: bytes ?? undefined,
    failureReason: undefined,
  });

  return {
    nextPayload,
    nextStatus: 'uploaded',
    duplicate: false,
  };
}

export function markUploadFailed(
  payload: unknown,
  reason: string,
  partial?: Partial<DataRecoveryUploadInfo>
): Record<string, unknown> {
  return mergeDataRecoveryUploadPayload(payload, {
    state: 'failed',
    failureReason: reason,
    ...partial,
  });
}
