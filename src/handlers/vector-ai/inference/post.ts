import { FastifyReply, FastifyRequest } from 'fastify';
import { invokeVectorAiInference } from '../../../services/sagemaker.service';

export const MAX_INFERENCE_BODY_BYTES = 6 * 1024 * 1024;

export const SUPPORTED_BINARY_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/octet-stream',
]);

export interface JsonInferenceRequest {
  image: string;
  content_type?: string;
  confidence?: number;
}

const detectionSchema = {
  type: 'object',
  properties: {
    box: {
      type: 'object',
      properties: {
        x1: { type: 'number' },
        y1: { type: 'number' },
        x2: { type: 'number' },
        y2: { type: 'number' },
      },
    },
    yolo_label: { type: 'string' },
    yolo_class_id: { type: 'integer' },
    yolo_score: { type: 'number' },
    tiny_cnn: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        score: { type: 'number' },
        probabilities: {
          type: 'array',
          items: { type: 'number' },
        },
      },
    },
  },
};

export const schema = {
  tags: ['Vector AI'],
  description:
    'Run YOLO + tiny-CNN inference via the vector-ai-inference SageMaker endpoint. ' +
    'Send JSON with a base64 image (optional confidence) or raw image bytes with an image/* Content-Type.',
  consumes: [
    'application/json',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/octet-stream',
  ],
  response: {
    200: {
      type: 'object',
      properties: {
        model: { type: 'string' },
        image_size: {
          type: 'array',
          items: { type: 'integer' },
        },
        detections: {
          type: 'array',
          items: detectionSchema,
        },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    415: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    503: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

function parseContentType(contentTypeHeader: string | undefined): string {
  return (contentTypeHeader || '').split(';')[0].trim().toLowerCase();
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

function validateJsonRequest(body: unknown): { ok: true; payload: JsonInferenceRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }

  const payload = body as JsonInferenceRequest;

  if (typeof payload.image !== 'string' || !payload.image.trim()) {
    return { ok: false, error: 'Field "image" is required and must be a base64-encoded string' };
  }

  if (!isValidBase64(payload.image)) {
    return { ok: false, error: 'Field "image" must be valid base64 without a data: URL prefix' };
  }

  if (payload.content_type !== undefined && typeof payload.content_type !== 'string') {
    return { ok: false, error: 'Field "content_type" must be a string when provided' };
  }

  if (payload.confidence !== undefined) {
    if (typeof payload.confidence !== 'number' || payload.confidence < 0 || payload.confidence > 1) {
      return { ok: false, error: 'Field "confidence" must be a number between 0.0 and 1.0' };
    }
  }

  return { ok: true, payload };
}

function buildJsonInvokeBody(payload: JsonInferenceRequest): Uint8Array {
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

export async function invokeInference(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const contentType = parseContentType(request.headers['content-type']);

    let invokeContentType: string;
    let invokeBody: Uint8Array;

    if (contentType === 'application/json') {
      const validation = validateJsonRequest(request.body);
      if (!validation.ok) {
        return reply.code(400).send({ error: validation.error });
      }

      invokeContentType = 'application/json';
      invokeBody = buildJsonInvokeBody(validation.payload);
    } else if (SUPPORTED_BINARY_CONTENT_TYPES.has(contentType)) {
      const body = request.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        return reply.code(400).send({ error: 'Request body must contain raw image bytes' });
      }

      invokeContentType = contentType;
      invokeBody = body;
    } else {
      return reply.code(415).send({
        error: 'Unsupported Content-Type. Use application/json or image/jpeg, image/png, image/webp, application/octet-stream.',
      });
    }

    if (invokeBody.byteLength > MAX_INFERENCE_BODY_BYTES) {
      return reply.code(400).send({
        error: `Request body exceeds ${MAX_INFERENCE_BODY_BYTES} bytes. Resize the image before sending.`,
      });
    }

    const result = await invokeVectorAiInference({
      contentType: invokeContentType,
      body: invokeBody,
    });

    return reply.code(result.statusCode).send(result.body);
  } catch (error) {
    request.log.error({ err: error }, 'Vector AI inference request failed');
    return reply.code(502).send({ error: 'Failed to invoke inference endpoint' });
  }
}
