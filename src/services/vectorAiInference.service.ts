import { QueryTypes } from 'sequelize';
import sequelize from '../db';
import VectorAiModel, {
  VECTOR_AI_INFERENCE_FIELDS,
  VectorAiInferenceField,
} from '../db/models/VectorAiModel';
import VectorAiInferenceResult, {
  VectorAiInferenceResultLog,
} from '../db/models/VectorAiInferenceResult';
import pino from 'pino';
import { invokeVectorAiInference, InvokeVectorAiInferenceResult } from './sagemaker.service';
import { buildAppS3ReferenceInvokeBody } from '../handlers/vector-ai/inference/jsonPayload';

const logger = pino();

/** Fields the batch cron invokes today; sex and abdomen are skipped until endpoints exist. */
const CRON_INFERENCE_FIELDS: VectorAiInferenceField[] = ['species'];

const SKIPPED_CRON_FIELDS = VECTOR_AI_INFERENCE_FIELDS.filter(
  (field) => !CRON_INFERENCE_FIELDS.includes(field)
);

export interface VectorAiInferenceCronStats {
  modelsChecked: number;
  modelsRun: number;
  imagesProcessed: number;
  imagesSucceeded: number;
  imagesFailed: number;
  skippedFields: VectorAiInferenceField[];
}

interface PendingSpecimenImageRow {
  id: number;
  image_key: string;
}

function extractPredictedValue(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const predictedClass = (body as Record<string, unknown>).predicted_class;
  return typeof predictedClass === 'string' ? predictedClass : null;
}

/** Latest registered model row per program for a given prediction field. */
export async function getLatestVectorAiModelsForField(
  field: VectorAiInferenceField
): Promise<VectorAiModel[]> {
  const models = await VectorAiModel.findAll({
    where: { field },
    order: [['id', 'DESC']],
  });

  const latestByProgramId = new Map<number, VectorAiModel>();
  for (const model of models) {
    if (!latestByProgramId.has(model.programId)) {
      latestByProgramId.set(model.programId, model);
    }
  }

  return [...latestByProgramId.values()];
}

async function listSpecimenImagesPendingInference(
  vectorAiModel: VectorAiModel
): Promise<PendingSpecimenImageRow[]> {
  return sequelize.query<PendingSpecimenImageRow>(
    `SELECT si.id, si.image_key
     FROM specimen_images si
     INNER JOIN specimens sp ON sp.id = si.specimen_id
     INNER JOIN sessions sess ON sess.id = sp.session_id
     INNER JOIN sites site ON site.id = sess.site_id
     WHERE site.program_id = :programId
       AND NOT EXISTS (
         SELECT 1
         FROM vector_ai_inference_results vair
         WHERE vair.specimen_image_id = si.id
           AND vair.vector_ai_model_id = :vectorAiModelId
       )
     ORDER BY si.id ASC`,
    {
      replacements: {
        programId: vectorAiModel.programId,
        vectorAiModelId: vectorAiModel.id,
      },
      type: QueryTypes.SELECT,
    }
  );
}

export interface ResolveVectorAiModelInput {
  modelId?: number;
  version?: string;
  field?: VectorAiInferenceField;
  programId?: number;
}

export async function resolveVectorAiModel(
  input: ResolveVectorAiModelInput
): Promise<VectorAiModel | null> {
  if (input.modelId !== undefined) {
    return VectorAiModel.findByPk(input.modelId);
  }

  if (!input.version?.trim()) {
    return null;
  }

  const where: {
    version: string;
    field: VectorAiInferenceField;
    programId?: number;
  } = {
    version: input.version.trim(),
    field: input.field ?? 'species',
  };

  if (input.programId !== undefined) {
    where.programId = input.programId;
  }

  return VectorAiModel.findOne({
    where,
    order: [['id', 'DESC']],
  });
}

export interface RunAndStoreVectorAiInferenceForImageResult extends InvokeVectorAiInferenceResult {
  stored: boolean;
}

export async function runAndStoreVectorAiInferenceForImage(
  specimenImageId: number,
  imageKey: string,
  model: VectorAiModel
): Promise<RunAndStoreVectorAiInferenceForImageResult> {
  const result = await invokeVectorAiInference(
    {
      contentType: 'application/json',
      body: buildAppS3ReferenceInvokeBody(imageKey),
    },
    { endpointName: model.sagemakerEndpoint }
  );

  if (result.statusCode !== 200) {
    return { ...result, stored: false };
  }

  const resultLog = result.body as VectorAiInferenceResultLog;

  await VectorAiInferenceResult.upsert({
    specimenImageId,
    vectorAiModelId: model.id,
    value: extractPredictedValue(result.body),
    resultLog,
  });

  return { ...result, stored: true };
}

async function runInferenceForSpecimenImage(
  image: PendingSpecimenImageRow,
  model: VectorAiModel
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runAndStoreVectorAiInferenceForImage(image.id, image.image_key, model);
  if (result.statusCode !== 200 || !result.stored) {
    const errorBody =
      result.body && typeof result.body === 'object' && 'error' in (result.body as object)
        ? String((result.body as { error: unknown }).error)
        : `SageMaker returned status ${result.statusCode}`;
    return { ok: false, error: errorBody };
  }

  return { ok: true };
}

export async function runVectorAiInferenceCron(): Promise<VectorAiInferenceCronStats> {
  const stats: VectorAiInferenceCronStats = {
    modelsChecked: 0,
    modelsRun: 0,
    imagesProcessed: 0,
    imagesSucceeded: 0,
    imagesFailed: 0,
    skippedFields: [...SKIPPED_CRON_FIELDS],
  };

  for (const field of VECTOR_AI_INFERENCE_FIELDS) {
    if (!CRON_INFERENCE_FIELDS.includes(field)) {
      continue;
    }

    const models = await getLatestVectorAiModelsForField(field);
    stats.modelsChecked += models.length;

    for (const model of models) {
      stats.modelsRun += 1;

      const pendingImages = await listSpecimenImagesPendingInference(model);

      for (const image of pendingImages) {
        stats.imagesProcessed += 1;

        const outcome = await runInferenceForSpecimenImage(image, model);
        if (outcome.ok) {
          stats.imagesSucceeded += 1;
        } else {
          stats.imagesFailed += 1;
          logger.warn(
            {
              specimenImageId: image.id,
              vectorAiModelId: model.id,
              programId: model.programId,
              field: model.field,
              error: outcome.error,
            },
            'Vector AI inference failed for specimen image'
          );
        }
      }
    }
  }

  return stats;
}
