import { FastifyRequest, FastifyReply } from 'fastify';
import { Specimen, Session, InferenceResult, SpecimenImage } from '../../db/models';

export interface ImageResponse {
  id: number;
  url: string;
  species: string | null;
  sex: string | null;
  abdomenStatus: string | null;
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
    speciesProbabilities: number[];
    sexProbabilities: number[];
    abdomenStatusProbabilities: number[];
  } | null;
}

// Specimen response format interface
export interface SpecimenResponse {
  id: number;
  specimenId: string;
  sessionId: number;
  thumbnailUrl: string | null;
  thumbnailImageId: number | null;
  images: Array<ImageResponse>;
  thumbnailImage: ImageResponse | null;
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
export async function formatSpecimenResponse(specimen: Specimen, allImages: boolean = true): Promise<SpecimenResponse> {
  let thumbnailImageObj = null;
  let imagesToReturn: ImageResponse[] = [];

  if (allImages) {
    // Get all images for this specimen
    const images = await SpecimenImage.findAll({
      where: { specimenId: specimen.id }
    });
    // For each image, get its inference result
    const imagesResponses = await Promise.all(images.map(async (img) => {
      const inferenceResult = await InferenceResult.findOne({
        where: { specimenImageId: img.id }
      });
      return {
        id: img.id,
        url: `/specimens/${specimen.specimenId}/images/${img.id}`,
        species: img.species,
        sex: img.sex,
        abdomenStatus: img.abdomenStatus,
        capturedAt: img.capturedAt ? img.capturedAt.getTime() : null,
        submittedAt: img.createdAt.getTime(), // Add this line
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
        } : null
      };
    }));
    imagesToReturn = imagesResponses;
    thumbnailImageObj = imagesResponses.find(img => img.id === specimen.thumbnailImageId) || null;
  } else {
    // Only fetch the thumbnail image (if exists)
    const thumbnailImage = specimen.thumbnailImageId ? await SpecimenImage.findByPk(specimen.thumbnailImageId) : null;
    if (thumbnailImage) {
      const inferenceResult = await InferenceResult.findOne({
        where: { specimenImageId: thumbnailImage.id }
      });
      const thumbDetail = {
        id: thumbnailImage.id,
        url: `/specimens/${specimen.specimenId}/images/${thumbnailImage.id}`,
        species: thumbnailImage.species,
        sex: thumbnailImage.sex,
        abdomenStatus: thumbnailImage.abdomenStatus,
        capturedAt: thumbnailImage.capturedAt ? thumbnailImage.capturedAt.getTime() : null,
        submittedAt: thumbnailImage.createdAt.getTime(), // Add this line
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
        } : null
      };
      imagesToReturn = [thumbDetail];
      thumbnailImageObj = thumbDetail;
    }
  }

  return {
    id: specimen.id,
    specimenId: specimen.specimenId,
    sessionId: specimen.sessionId,
    thumbnailUrl: specimen.thumbnailImageId && thumbnailImageObj ? thumbnailImageObj.url : null,
    thumbnailImageId: specimen.thumbnailImageId,
    images: imagesToReturn,
    thumbnailImage: thumbnailImageObj,
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
