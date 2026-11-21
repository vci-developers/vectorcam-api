import { FastifyInstance } from 'fastify';
import {
  invokeInference,
  inferenceSchema,
  runSpecimenImageVectorAiInference,
  specimenImageInferenceSchema,
} from '../handlers/vector-ai';
import {
  MAX_INFERENCE_BODY_BYTES,
  SUPPORTED_BINARY_CONTENT_TYPES,
} from '../handlers/vector-ai/inference/post';
import { requirePermission } from '../middleware/permission.middleware';

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
    preHandler: [requirePermission('mobile:app')],
    schema: inferenceSchema,
    bodyLimit: MAX_INFERENCE_BODY_BYTES,
  }, invokeInference as any);

  fastify.post('/specimens/:specimen_id/images/:image_id/inference', {
    preHandler: [requirePermission('system:admin')],
    schema: specimenImageInferenceSchema,
  }, runSpecimenImageVectorAiInference as any);

  done();
}
