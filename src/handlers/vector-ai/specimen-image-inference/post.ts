import { FastifyReply, FastifyRequest } from 'fastify';
import { Specimen } from '../../../db/models';
import { findSpecimenImage } from '../../specimen/common';
import { VECTOR_AI_INFERENCE_FIELDS } from '../../../db/models/VectorAiModel';
import {
  resolveVectorAiModel,
  runAndStoreVectorAiInferenceForImage,
} from '../../../services/vectorAiInference.service';

export interface RunSpecimenImageVectorAiInferenceBody {
  modelId?: number;
  version?: string;
  field?: (typeof VECTOR_AI_INFERENCE_FIELDS)[number];
  programId?: number;
}

export const schema = {
  tags: ['Vector AI'],
  description:
    'Run Vector AI inference for one specimen image using a configured model (admin only). ' +
    'On HTTP 200 from SageMaker, upserts vector_ai_inference_results. Returns the upstream body as-is.',
  params: {
    type: 'object',
    required: ['specimen_id', 'image_id'],
    properties: {
      specimen_id: { type: 'number' },
      image_id: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      modelId: { type: 'number' },
      version: { type: 'string' },
      field: { type: 'string', enum: [...VECTOR_AI_INFERENCE_FIELDS] },
      programId: { type: 'number' },
    },
  },
  response: {
    200: {
      type: 'object',
      additionalProperties: true,
    },
  },
};

export async function runSpecimenImageVectorAiInference(
  request: FastifyRequest<{
    Params: { specimen_id: number; image_id: string };
    Body: RunSpecimenImageVectorAiInferenceBody;
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { specimen_id, image_id } = request.params;
    const body = request.body ?? {};

    if (body.modelId === undefined && !body.version?.trim()) {
      return reply.code(400).send({ error: 'Provide modelId or version' });
    }

    const specimen = await Specimen.findByPk(specimen_id);
    if (!specimen) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }

    const image = await findSpecimenImage(specimen.id, image_id);
    if (!image) {
      return reply.code(404).send({ error: 'Image not found' });
    }

    const model = await resolveVectorAiModel({
      modelId: body.modelId,
      version: body.version,
      field: body.field,
      programId: body.programId,
    });

    if (!model) {
      return reply.code(404).send({ error: 'Vector AI model not found' });
    }

    const result = await runAndStoreVectorAiInferenceForImage(image.id, image.imageKey, model);

    return reply.code(result.statusCode).send(result.body);
  } catch (error) {
    request.log.error({ err: error }, 'Specimen image Vector AI inference failed');
    return reply.code(502).send({ error: 'Failed to run specimen image inference' });
  }
}
