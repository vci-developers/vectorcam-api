import { FastifyInstance } from 'fastify';
import { invokeInference, inferenceSchema } from '../handlers/vector-ai';
import {
  MAX_INFERENCE_BODY_BYTES,
  SUPPORTED_BINARY_CONTENT_TYPES,
} from '../handlers/vector-ai/inference/post';
import { requireAdminOrMobileAuth } from '../middleware/auth.middleware';

export default function vectorAiRoutes(fastify: FastifyInstance, opts: object, done: () => void): void {
  for (const contentType of SUPPORTED_BINARY_CONTENT_TYPES) {
    fastify.addContentTypeParser(
      contentType,
      { parseAs: 'buffer', bodyLimit: MAX_INFERENCE_BODY_BYTES },
      (_request, body, parserDone) => {
        parserDone(null, body);
      }
    );
  }

  fastify.post('/inference', {
    preHandler: [requireAdminOrMobileAuth],
    schema: inferenceSchema,
    bodyLimit: MAX_INFERENCE_BODY_BYTES,
    config: { skipSiteAccess: true },
  }, invokeInference as any);

  done();
}
