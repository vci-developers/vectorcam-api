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
    speciesLogits: number[];
    sexLogits: number[];
    abdomenStatusLogits: number[];
    speciesInferenceDuration: number | null;
    sexInferenceDuration: number | null;
    abdomenStatusInferenceDuration: number | null;
    bboxDetectionDuration: number | null;
  } | null;
}

// Specimen response format interface
export interface SpecimenResponse {
  id: number;
  specimenId: string;
  sessionId: number;
  thumbnailUrl: string | null;
  thumbnailImageId: number | null;
  shouldProcessFurther: boolean;
  images: Array<ImageResponse>;
  thumbnailImage: ImageResponse | null;
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
        url: `/specimens/${specimen.id}/images/${img.id}`,
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
          speciesLogits: parseProbabilityString(inferenceResult.speciesLogits),
          sexLogits: parseProbabilityString(inferenceResult.sexLogits),
          abdomenStatusLogits: parseProbabilityString(inferenceResult.abdomenStatusLogits),
          speciesInferenceDuration: inferenceResult.speciesInferenceDuration,
          sexInferenceDuration: inferenceResult.sexInferenceDuration,
          abdomenStatusInferenceDuration: inferenceResult.abdomenStatusInferenceDuration,
          bboxDetectionDuration: inferenceResult.bboxDetectionDuration
        } : null
      };
    }));
    imagesToReturn = imagesResponses;
    thumbnailImageObj = imagesResponses.find(img => img.id === specimen.thumbnailImageId) ?? null;
  } else {
    // Only fetch the thumbnail image (if exists)
    const thumbnailImage = specimen.thumbnailImageId ? await SpecimenImage.findByPk(specimen.thumbnailImageId) : null;
    if (thumbnailImage) {
      const inferenceResult = await InferenceResult.findOne({
        where: { specimenImageId: thumbnailImage.id }
      });
      const thumbDetail = {
        id: thumbnailImage.id,
        url: `/specimens/${specimen.id}/images/${thumbnailImage.id}`,
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
          speciesLogits: parseProbabilityString(inferenceResult.speciesLogits),
          sexLogits: parseProbabilityString(inferenceResult.sexLogits),
          abdomenStatusLogits: parseProbabilityString(inferenceResult.abdomenStatusLogits),
          speciesInferenceDuration: inferenceResult.speciesInferenceDuration,
          sexInferenceDuration: inferenceResult.sexInferenceDuration,
          abdomenStatusInferenceDuration: inferenceResult.abdomenStatusInferenceDuration,
          bboxDetectionDuration: inferenceResult.bboxDetectionDuration
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
    shouldProcessFurther: specimen.shouldProcessFurther,
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
