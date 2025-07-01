import { FastifyRequest, FastifyReply } from 'fastify';
import { Specimen, Session, InferenceResult, SpecimenImage } from '../../db/models';

// Specimen response format interface
export interface SpecimenResponse {
  id: number;
  specimenId: string;
  sessionId: number;
  species: string | null;
  sex: string | null;
  abdomenStatus: string | null;
  capturedAt: number | null;
  thumbnailUrl: string | null;
  thumbnailImageId: number | null;
  images: Array<{
    id: number;
    url: string;
  }>;
  inferenceResult: {
    id: number;
    bboxTopLeftX: number;
    bboxTopLeftY: number;
    bboxWidth: number;
    bboxHeight: number;
    bboxConfidence?: number;
    bboxClassId?: number;
    speciesProbabilities: number[];
    sexProbabilities: number[];
    abdomenStatusProbabilities: number[];
  } | null;
  submittedAt: number;
}

// Helper function to parse probability string to array
function parseProbabilityString(str: string): number[] {
  try {
    return JSON.parse(str);
  } catch (error) {
    console.error('Error parsing probability string:', error);
    return [];
  }
}

// Helper to format specimen data consistently across endpoints
export async function formatSpecimenResponse(specimen: Specimen): Promise<SpecimenResponse> {
  // Get all images for this specimen
  const images = await SpecimenImage.findAll({
    where: { specimenId: specimen.id }
  });

  // Get the inference result if it exists
  const inferenceResult = await InferenceResult.findOne({
    where: { specimenId: specimen.id }
  });

  // Get the thumbnail image if it exists
  const thumbnailImage = specimen.thumbnailImageId ? await SpecimenImage.findByPk(specimen.thumbnailImageId) : null;

  return {
    id: specimen.id,
    specimenId: specimen.specimenId,
    sessionId: specimen.sessionId,
    species: specimen.species,
    sex: specimen.sex,
    abdomenStatus: specimen.abdomenStatus,
    capturedAt: specimen.capturedAt ? specimen.capturedAt.getTime() : null,
    thumbnailUrl: thumbnailImage ? `/specimens/${specimen.specimenId}/images/${thumbnailImage.id}` : null,
    thumbnailImageId: specimen.thumbnailImageId,
    images: images.map(img => ({
      id: img.id,
      url: `/specimens/${specimen.specimenId}/images/${img.id}`
    })),
    inferenceResult: inferenceResult ? {
      id: inferenceResult.id,
      bboxTopLeftX: inferenceResult.bboxTopLeftX,
      bboxTopLeftY: inferenceResult.bboxTopLeftY,
      bboxWidth: inferenceResult.bboxWidth,
      bboxHeight: inferenceResult.bboxHeight,
      bboxConfidence: inferenceResult.bboxConfidence,
      bboxClassId: inferenceResult.bboxClassId,
      speciesProbabilities: parseProbabilityString(inferenceResult.speciesProbabilities),
      sexProbabilities: parseProbabilityString(inferenceResult.sexProbabilities),
      abdomenStatusProbabilities: parseProbabilityString(inferenceResult.abdomenStatusProbabilities)
    } : null,
    submittedAt: specimen.createdAt.getTime(),
  };
}

// Helper function to determine if a string is a valid numeric ID
export function isValidId(id: string): boolean {
  return !isNaN(Number(id)) && Number(id) > 0;
}

// Helper function to find a specimen by either ID or key
export async function findSpecimen(id: string, include?: any[]): Promise<Specimen | null> {
  // If the id is a valid number, try to find by numeric id first
  // if (isValidId(id)) {
  //   const specimen = await Specimen.findByPk(Number(id), { include });
  //   if (specimen) return specimen;
  // }
  
  // If not found by numeric id or id is not a number, try to find by specimenId
  return Specimen.findOne({
    where: { specimenId: id },
    include
  });
}

// Check if session exists by ID
export async function findSessionById(id: number): Promise<Session | null> {
  return Session.findByPk(id);
}

// Check if inference result exists by specimen ID
export async function findInferenceResultBySpecimenId(specimenId: number): Promise<InferenceResult | null> {
  return InferenceResult.findOne({
    where: { specimenId }
  });
}

// Common error handler
export function handleError(error: any, request: FastifyRequest, reply: FastifyReply, defaultMessage: string): void {
  console.error(`Error in ${request.method} ${request.url}:`, error);
  reply.code(500).send({ error: defaultMessage });
}
