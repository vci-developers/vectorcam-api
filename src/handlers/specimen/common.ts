import { FastifyRequest, FastifyReply } from 'fastify';
import {
  Specimen,
  Session,
  InferenceResult,
  SpecimenImage,
  SessionUnit,
  VectorAiInferenceResult,
  VectorAiModel,
} from '../../db/models';
import { VectorAiInferenceField } from '../../db/models/VectorAiModel';

export type VectorAiPredictions = Partial<Record<VectorAiInferenceField, string | null>>;

export interface ImageResponse {
  id: number;
  url: string;
  metadata: Record<string, unknown> | null;
  species: string | null;
  sex: string | null;
  abdomenStatus: string | null;
  appSpecies: string | null;
  appSex: string | null;
  appAbdomenStatus: string | null;
  capturedAt: number | null;
  submittedAt: number; // Add this field
  inferenceResult: {
    id: number;
    bboxTopLeftX: number;
    bboxTopLeftY: number;
    bboxWidth: number;
    bboxHeight: number;
    bboxConfidence: number;
    bboxClassId: number;
    speciesLogits: number[];
    sexLogits: number[];
    abdomenStatusLogits: number[];
    speciesInferenceDuration: number | null;
    sexInferenceDuration: number | null;
    abdomenStatusInferenceDuration: number | null;
    bboxDetectionDuration: number | null;
  } | null;
  vectorAiPredictions: VectorAiPredictions;
}

const inferenceResultObjectSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    bboxTopLeftX: { type: 'number' },
    bboxTopLeftY: { type: 'number' },
    bboxWidth: { type: 'number' },
    bboxHeight: { type: 'number' },
    bboxConfidence: { type: 'number' },
    bboxClassId: { type: 'number' },
    speciesLogits: { type: 'array', items: { type: 'number' } },
    sexLogits: { type: 'array', items: { type: 'number' } },
    abdomenStatusLogits: { type: 'array', items: { type: 'number' } },
    speciesInferenceDuration: { type: ['number', 'null'] },
    sexInferenceDuration: { type: ['number', 'null'] },
    abdomenStatusInferenceDuration: { type: ['number', 'null'] },
    bboxDetectionDuration: { type: ['number', 'null'] },
  },
} as const;

/** Shared Fastify response schema for on-device and Vector AI inference on specimen images. */
export const specimenImageInferenceResponseSchemaProperties = {
  inferenceResult: {
    anyOf: [{ type: 'null' }, inferenceResultObjectSchema],
  },
  vectorAiPredictions: {
    type: 'object',
    additionalProperties: false,
    properties: {
      species: { type: ['string', 'null'] },
      sex: { type: ['string', 'null'] },
      abdomen_status: { type: ['string', 'null'] },
    },
  },
} as const;

export function getSpecimenImageInferenceInclude() {
  return [
    {
      model: InferenceResult,
      as: 'inferenceResult',
      required: false,
    },
    {
      model: VectorAiInferenceResult,
      as: 'vectorAiInferenceResults',
      required: false,
      include: [
        {
          model: VectorAiModel,
          as: 'vectorAiModel',
          required: false,
        },
      ],
    },
  ];
}

export const vectorAiPredictionCsvColumnHeaders = [
  'VectorAiPredictionsSpecies',
  'VectorAiPredictionsSex',
  'VectorAiPredictionsAbdomenStatus',
] as const;

export const vectorAiPredictionCsvHeaderSuffix = vectorAiPredictionCsvColumnHeaders.join(',');

export function buildVectorAiPredictionsFromRows(
  rows: VectorAiInferenceResult[] | undefined | null
): VectorAiPredictions {
  if (!rows?.length) {
    return {};
  }

  const latestByField = new Map<VectorAiInferenceField, VectorAiInferenceResult>();

  for (const row of rows) {
    const vectorAiModel = (row as VectorAiInferenceResult & { vectorAiModel?: VectorAiModel }).vectorAiModel;
    const field = vectorAiModel?.field;
    if (!field) {
      continue;
    }

    const existing = latestByField.get(field);
    if (!existing || row.vectorAiModelId > existing.vectorAiModelId) {
      latestByField.set(field, row);
    }
  }

  const predictions: VectorAiPredictions = {};
  for (const [field, row] of latestByField) {
    predictions[field] = row.value;
  }

  return predictions;
}

export function formatVectorAiPredictions(img: SpecimenImage): VectorAiPredictions {
  return buildVectorAiPredictionsFromRows(
    (img as SpecimenImage & { vectorAiInferenceResults?: VectorAiInferenceResult[] }).vectorAiInferenceResults
  );
}

export function getVectorAiPredictionCsvValues(predictions: VectorAiPredictions): {
  species: string | null;
  sex: string | null;
  abdomenStatus: string | null;
} {
  return {
    species: predictions.species ?? null,
    sex: predictions.sex ?? null,
    abdomenStatus: predictions.abdomen_status ?? null,
  };
}

export async function enrichSpecimenImageInferenceData(image: SpecimenImage): Promise<void> {
  const imageWithAssociations = image as SpecimenImage & {
    inferenceResult?: InferenceResult | null;
    vectorAiInferenceResults?: VectorAiInferenceResult[];
  };

  const tasks: Promise<void>[] = [];

  if (imageWithAssociations.inferenceResult === undefined) {
    tasks.push(
      InferenceResult.findOne({ where: { specimenImageId: image.id } }).then((inferenceResult) => {
        imageWithAssociations.inferenceResult = inferenceResult;
      })
    );
  }

  if (imageWithAssociations.vectorAiInferenceResults === undefined) {
    tasks.push(
      VectorAiInferenceResult.findAll({
        where: { specimenImageId: image.id },
        include: [{ model: VectorAiModel, as: 'vectorAiModel', required: false }],
        order: [['id', 'ASC']],
      }).then((vectorAiInferenceResults) => {
        imageWithAssociations.vectorAiInferenceResults = vectorAiInferenceResults;
      })
    );
  }

  await Promise.all(tasks);
}

export interface SessionUnitResponse {
  id: number;
  frontendId: string | null;
  sessionId: number;
  unitOrder: number;
  createdAt: number | null;
  updatedAt: number | null;
}

// Specimen response format interface
export interface SpecimenResponse {
  id: number;
  specimenId: string;
  sessionId: number;
  sessionUnitId: number | null;
  sessionUnit: SessionUnitResponse | null;
  thumbnailUrl: string | null;
  thumbnailImageId: number | null;
  shouldProcessFurther: boolean;
  expectedImages: number;
  images: Array<ImageResponse>;
  thumbnailImage: ImageResponse | null;
}

/** JSON Schema properties for current and app-submitted prediction fields on specimen images. */
export const specimenImagePredictionSchemaProperties = {
  species: { type: ['string', 'null'] },
  sex: { type: ['string', 'null'] },
  abdomenStatus: { type: ['string', 'null'] },
  appSpecies: { type: ['string', 'null'] },
  appSex: { type: ['string', 'null'] },
  appAbdomenStatus: { type: ['string', 'null'] },
} as const;

export function specimenImagePredictionCreateFields(input: {
  species?: string;
  sex?: string;
  abdomenStatus?: string;
}) {
  const { species, sex, abdomenStatus } = input;
  return {
    species,
    sex,
    abdomenStatus,
    appSpecies: species,
    appSex: sex,
    appAbdomenStatus: abdomenStatus,
  };
}

// Helper function to parse probability string to array
export function parseProbabilityString(str: string | null): number[] {
  if (!str) {
    return [];
  }
  try {
    return JSON.parse(str);
  } catch (error) {
    console.error('Error parsing probability string:', error);
    return [];
  }
}

export function formatImageResponse(specimenId: number, img: SpecimenImage): ImageResponse {
  const inferenceResult = (img as any).inferenceResult;

  return {
    id: img.id,
    url: `/specimens/${specimenId}/images/${img.id}`,
    metadata: img.metadata ?? null,
    species: img.species,
    sex: img.sex,
    abdomenStatus: img.abdomenStatus,
    appSpecies: img.appSpecies ?? null,
    appSex: img.appSex ?? null,
    appAbdomenStatus: img.appAbdomenStatus ?? null,
    capturedAt: img.capturedAt ? img.capturedAt.getTime() : null,
    submittedAt: img.createdAt.getTime(),
    inferenceResult: inferenceResult ? {
      id: inferenceResult.id,
      bboxTopLeftX: inferenceResult.bboxTopLeftX,
      bboxTopLeftY: inferenceResult.bboxTopLeftY,
      bboxWidth: inferenceResult.bboxWidth,
      bboxHeight: inferenceResult.bboxHeight,
      bboxConfidence: inferenceResult.bboxConfidence,
      bboxClassId: inferenceResult.bboxClassId,
      speciesLogits: parseProbabilityString(inferenceResult.speciesLogits),
      sexLogits: parseProbabilityString(inferenceResult.sexLogits),
      abdomenStatusLogits: parseProbabilityString(inferenceResult.abdomenStatusLogits),
      speciesInferenceDuration: inferenceResult.speciesInferenceDuration,
      sexInferenceDuration: inferenceResult.sexInferenceDuration,
      abdomenStatusInferenceDuration: inferenceResult.abdomenStatusInferenceDuration,
      bboxDetectionDuration: inferenceResult.bboxDetectionDuration
    } : null,
    vectorAiPredictions: formatVectorAiPredictions(img),
  };
}

export function formatSessionUnitResponse(unit: SessionUnit | null | undefined): SessionUnitResponse | null {
  if (!unit) return null;

  return {
    id: unit.id,
    frontendId: unit.frontendId ?? null,
    sessionId: unit.sessionId,
    unitOrder: unit.unitOrder,
    createdAt: unit.createdAt?.getTime?.() ?? null,
    updatedAt: unit.updatedAt?.getTime?.() ?? null,
  };
}

async function resolveSpecimenSessionUnit(specimen: Specimen): Promise<SessionUnit | null> {
  const included = specimen.get('sessionUnit') as SessionUnit | undefined;
  if (included) return included;
  if (specimen.sessionUnitId === null || specimen.sessionUnitId === undefined) return null;
  return SessionUnit.findByPk(specimen.sessionUnitId);
}

export function formatSpecimenResponseFromImages(specimen: Specimen, images: SpecimenImage[]): SpecimenResponse {
  const imagesToReturn = images.map((img) => formatImageResponse(specimen.id, img));
  const thumbnailImageObj = imagesToReturn.find(img => img.id === specimen.thumbnailImageId) ?? null;
  const sessionUnit = specimen.get('sessionUnit') as SessionUnit | undefined;

  return {
    id: specimen.id,
    specimenId: specimen.specimenId,
    sessionId: specimen.sessionId,
    sessionUnitId: specimen.sessionUnitId ?? null,
    sessionUnit: formatSessionUnitResponse(sessionUnit),
    thumbnailUrl: specimen.thumbnailImageId && thumbnailImageObj ? thumbnailImageObj.url : null,
    thumbnailImageId: specimen.thumbnailImageId,
    shouldProcessFurther: specimen.shouldProcessFurther,
    expectedImages: specimen.expectedImages,
    images: imagesToReturn,
    thumbnailImage: thumbnailImageObj,
  };
}

// Helper to format specimen data consistently across endpoints
export async function formatSpecimenResponse(specimen: Specimen, allImages: boolean = true): Promise<SpecimenResponse> {
  let thumbnailImageObj = null;
  let imagesToReturn: ImageResponse[] = [];
  const sessionUnit = await resolveSpecimenSessionUnit(specimen);

  if (allImages) {
    // Get all images with their inference results in a single query using eager loading
    const images = await SpecimenImage.findAll({
      where: { specimenId: specimen.id },
      include: getSpecimenImageInferenceInclude(),
    });
    
    // Transform the results
    const imagesResponses = images.map((img) => formatImageResponse(specimen.id, img));
    imagesToReturn = imagesResponses;
    thumbnailImageObj = imagesResponses.find(img => img.id === specimen.thumbnailImageId) ?? null;
  } else {
    // Only fetch the thumbnail image with its inference result in a single query
    const thumbnailImage = specimen.thumbnailImageId 
      ? await SpecimenImage.findByPk(specimen.thumbnailImageId, {
          include: getSpecimenImageInferenceInclude(),
        })
      : null;
      
    if (thumbnailImage) {
      const thumbDetail = formatImageResponse(specimen.id, thumbnailImage);
      imagesToReturn = [thumbDetail];
      thumbnailImageObj = thumbDetail;
    }
  }

  return {
    id: specimen.id,
    specimenId: specimen.specimenId,
    sessionId: specimen.sessionId,
    sessionUnitId: specimen.sessionUnitId ?? null,
    sessionUnit: formatSessionUnitResponse(sessionUnit),
    thumbnailUrl: specimen.thumbnailImageId && thumbnailImageObj ? thumbnailImageObj.url : null,
    thumbnailImageId: specimen.thumbnailImageId,
    shouldProcessFurther: specimen.shouldProcessFurther,
    expectedImages: specimen.expectedImages,
    images: imagesToReturn,
    thumbnailImage: thumbnailImageObj,
  };
}

// Helper function to determine if a string is a valid numeric ID
export function isValidId(id: string): boolean {
  return !isNaN(Number(id)) && Number(id) > 0;
}

// Check if session exists by ID
export async function findSessionById(id: number): Promise<Session | null> {
  return Session.findByPk(id);
}

export async function validateSpecimenSessionUnit(
  session: Session,
  sessionUnitId?: number | null
): Promise<string | null> {
  if (sessionUnitId === null || sessionUnitId === undefined) {
    return null;
  }

  const unit = await SessionUnit.findOne({ where: { id: sessionUnitId, sessionId: session.id } });
  if (!unit) {
    return 'sessionUnitId does not belong to this session';
  }

  return null;
}

// Check if inference result exists by specimen ID
export async function findInferenceResultBySpecimenId(specimenId: number): Promise<InferenceResult | null> {
  return InferenceResult.findOne({
    where: { specimenId }
  });
}

// Helper to find a specimen image by id or filemd5
export async function findSpecimenImage(specimenId: number, imageId: string | number): Promise<SpecimenImage | null> {
  // Try numeric id first if possible
  if (typeof imageId === 'number' || (/^\d+$/.test(imageId))) {
    const idNum = typeof imageId === 'number' ? imageId : parseInt(imageId, 10);
    let image = await SpecimenImage.findOne({ where: { id: idNum, specimenId } });
    if (image) return image;
    // If not found, try as filemd5
    image = await SpecimenImage.findOne({ where: { filemd5: String(imageId), specimenId } });
    return image;
  } else {
    // Not a number, treat as filemd5
    return await SpecimenImage.findOne({ where: { filemd5: String(imageId), specimenId } });
  }
}

// Common error handler
export function handleError(error: any, request: FastifyRequest, reply: FastifyReply, defaultMessage: string): void {
  console.error(`Error in ${request.method} ${request.url}:`, error);
  reply.code(500).send({ error: defaultMessage });
}
