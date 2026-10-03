import { config } from '../../../config/environment';

export interface JsonBase64InferenceRequest {
  kind: 'base64';
  image: string;
  content_type?: string;
  confidence?: number;
}

export interface JsonS3InferenceRequest {
  kind: 's3';
  s3_uri?: string;
  s3_bucket?: string;
  s3_key?: string;
  s3_region?: string;
  s3_version_id?: string;
  confidence?: number;
}

export type JsonInferenceRequest = JsonBase64InferenceRequest | JsonS3InferenceRequest;

function validateConfidence(
  confidence: unknown
): { ok: true; value?: number } | { ok: false; error: string } {
  if (confidence === undefined) {
    return { ok: true };
  }
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    return { ok: false, error: 'Field "confidence" must be a number between 0.0 and 1.0' };
  }
  return { ok: true, value: confidence };
}

function isValidBase64(value: string): boolean {
  if (!value || value.includes('data:')) {
    return false;
  }

  const normalized = value.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    return false;
  }

  try {
    return Buffer.from(normalized, 'base64').length > 0;
  } catch {
    return false;
  }
}

function isValidS3Uri(value: string): boolean {
  if (!value.startsWith('s3://')) {
    return false;
  }
  const withoutScheme = value.slice('s3://'.length);
  const slashIndex = withoutScheme.indexOf('/');
  return slashIndex > 0 && slashIndex < withoutScheme.length - 1;
}

function validateS3Json(body: Record<string, unknown>):
  | { ok: true; payload: JsonS3InferenceRequest }
  | { ok: false; error: string } {
  const hasUri = typeof body.s3_uri === 'string' && body.s3_uri.trim().length > 0;
  const hasBucket = typeof body.s3_bucket === 'string' && body.s3_bucket.trim().length > 0;
  const hasKey = typeof body.s3_key === 'string' && body.s3_key.trim().length > 0;

  if (hasUri && (hasBucket || hasKey)) {
    return {
      ok: false,
      error: 'Provide either "s3_uri" or both "s3_bucket" and "s3_key", not both forms',
    };
  }

  if (!hasUri && !(hasBucket && hasKey)) {
    return {
      ok: false,
      error:
        'JSON must include a base64 "image", or an S3 reference via "s3_uri" or "s3_bucket" and "s3_key"',
    };
  }

  if (hasUri) {
    const s3Uri = (body.s3_uri as string).trim();
    if (!isValidS3Uri(s3Uri)) {
      return { ok: false, error: 'Field "s3_uri" must be a valid s3://bucket/key URI' };
    }
  } else {
    if (!hasBucket) {
      return { ok: false, error: 'Field "s3_bucket" is required with "s3_key"' };
    }
    if (!hasKey) {
      return { ok: false, error: 'Field "s3_key" is required with "s3_bucket"' };
    }
  }

  if (body.s3_region !== undefined && typeof body.s3_region !== 'string') {
    return { ok: false, error: 'Field "s3_region" must be a string when provided' };
  }

  if (body.s3_version_id !== undefined && typeof body.s3_version_id !== 'string') {
    return { ok: false, error: 'Field "s3_version_id" must be a string when provided' };
  }

  const confidenceResult = validateConfidence(body.confidence);
  if (!confidenceResult.ok) {
    return confidenceResult;
  }

  const payload: JsonS3InferenceRequest = { kind: 's3', confidence: confidenceResult.value };

  if (hasUri) {
    payload.s3_uri = (body.s3_uri as string).trim();
  } else {
    payload.s3_bucket = (body.s3_bucket as string).trim();
    payload.s3_key = (body.s3_key as string).trim();
    if (typeof body.s3_region === 'string' && body.s3_region.trim()) {
      payload.s3_region = body.s3_region.trim();
    }
    if (typeof body.s3_version_id === 'string' && body.s3_version_id.trim()) {
      payload.s3_version_id = body.s3_version_id.trim();
    }
  }

  if (hasUri && typeof body.s3_version_id === 'string' && body.s3_version_id.trim()) {
    payload.s3_version_id = body.s3_version_id.trim();
  }

  return { ok: true, payload };
}

export function validateJsonRequest(
  body: unknown
): { ok: true; payload: JsonInferenceRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }

  const record = body as Record<string, unknown>;

  const looksLikeS3 =
    record.s3_uri !== undefined ||
    record.s3_bucket !== undefined ||
    record.s3_key !== undefined ||
    record.s3_region !== undefined ||
    record.s3_version_id !== undefined;

  if (looksLikeS3) {
    return validateS3Json(record);
  }

  if (typeof record.image !== 'string' || !record.image.trim()) {
    return { ok: false, error: 'Field "image" is required and must be a base64-encoded string' };
  }

  if (!isValidBase64(record.image)) {
    return { ok: false, error: 'Field "image" must be valid base64 without a data: URL prefix' };
  }

  if (record.content_type !== undefined && typeof record.content_type !== 'string') {
    return { ok: false, error: 'Field "content_type" must be a string when provided' };
  }

  const confidenceResult = validateConfidence(record.confidence);
  if (!confidenceResult.ok) {
    return confidenceResult;
  }

  return {
    ok: true,
    payload: {
      kind: 'base64',
      image: record.image,
      content_type:
        typeof record.content_type === 'string' ? record.content_type : undefined,
      confidence: confidenceResult.value,
    },
  };
}

export function buildJsonInvokeBody(payload: JsonInferenceRequest): Uint8Array {
  if (payload.kind === 's3') {
    const forward: Record<string, unknown> = {};

    if (payload.s3_uri) {
      forward.s3_uri = payload.s3_uri;
    } else {
      forward.s3_bucket = payload.s3_bucket;
      forward.s3_key = payload.s3_key;
      if (payload.s3_region) {
        forward.s3_region = payload.s3_region;
      }
    }

    if (payload.s3_version_id) {
      forward.s3_version_id = payload.s3_version_id;
    }

    if (payload.confidence !== undefined) {
      forward.confidence = payload.confidence;
    }

    return Buffer.from(JSON.stringify(forward));
  }

  const forwardPayload: Record<string, unknown> = {
    image: payload.image.replace(/\s/g, ''),
  };

  if (payload.content_type) {
    forwardPayload.content_type = payload.content_type;
  }

  if (payload.confidence !== undefined) {
    forwardPayload.confidence = payload.confidence;
  }

  return Buffer.from(JSON.stringify(forwardPayload));
}

/** JSON S3 reference for objects already stored in this API's bucket. */
export function buildAppS3ReferenceInvokeBody(
  imageKey: string,
  options: { confidence?: number } = {}
): Uint8Array {
  const forward: Record<string, unknown> = {
    s3_bucket: config.aws.s3BucketName,
    s3_key: imageKey,
    s3_region: config.aws.region,
  };

  if (options.confidence !== undefined) {
    forward.confidence = options.confidence;
  }

  return Buffer.from(JSON.stringify(forward));
}

export function jsonInvokeBodyCountsAgainstSizeLimit(payload: JsonInferenceRequest): boolean {
  return payload.kind === 'base64';
}
