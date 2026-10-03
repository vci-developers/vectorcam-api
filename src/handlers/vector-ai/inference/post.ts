import { FastifyReply, FastifyRequest } from 'fastify';
import { invokeVectorAiInference } from '../../../services/sagemaker.service';
import {
  buildJsonInvokeBody,
  jsonInvokeBodyCountsAgainstSizeLimit,
  validateJsonRequest,
} from './jsonPayload';

export const MAX_INFERENCE_BODY_BYTES = 6 * 1024 * 1024;

export const SUPPORTED_BINARY_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/octet-stream',
]);

export const schema = {
  tags: ['Vector AI'],
  description:
    'Transparent proxy to the vector-ai-inference SageMaker endpoint. ' +
    'Send JSON with an S3 reference (s3_uri or s3_bucket+s3_key), a base64 image (optional confidence), ' +
    'or raw image bytes with an image/* Content-Type. The upstream response body is returned as-is.',
  consumes: [
    'application/json',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/octet-stream',
  ],
};

function parseContentType(contentTypeHeader: string | undefined): string {
  return (contentTypeHeader || '').split(';')[0].trim().toLowerCase();
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

      if (
        jsonInvokeBodyCountsAgainstSizeLimit(validation.payload) &&
        invokeBody.byteLength > MAX_INFERENCE_BODY_BYTES
      ) {
        return reply.code(400).send({
          error: `Request body exceeds ${MAX_INFERENCE_BODY_BYTES} bytes. Use an S3 reference or resize the image.`,
        });
      }
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

    if (invokeContentType !== 'application/json' && invokeBody.byteLength > MAX_INFERENCE_BODY_BYTES) {
      return reply.code(400).send({
        error: `Request body exceeds ${MAX_INFERENCE_BODY_BYTES} bytes. Use JSON with an S3 reference or resize the image.`,
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
