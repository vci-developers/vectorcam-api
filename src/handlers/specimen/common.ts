import { FastifyRequest, FastifyReply } from 'fastify';
import { Specimen, Session, YoloBox, SpecimenImage } from '../../db/models';

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
  yoloBox: {
    yoloBoxId: number;
    topLeftX: number;
    topLeftY: number;
    width: number;
    height: number;
  } | null;
}

// Helper to format specimen data consistently across endpoints
export async function formatSpecimenResponse(specimen: Specimen): Promise<SpecimenResponse> {
  // Get all images for this specimen
  const images = await SpecimenImage.findAll({
    where: { specimenId: specimen.id }
  });

  // Get the yoloBox if it exists
  const yoloBox = specimen.yoloBoxId ? await YoloBox.findByPk(specimen.yoloBoxId) : null;

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
    yoloBox: yoloBox ? {
      yoloBoxId: yoloBox.id,
      topLeftX: yoloBox.topLeftX,
      topLeftY: yoloBox.topLeftY,
      width: yoloBox.width,
      height: yoloBox.height
    } : null
  };
}

// Helper function to determine if a string is a valid numeric ID
export function isValidId(id: string): boolean {
  return !isNaN(Number(id)) && Number(id) > 0;
}

// Helper function to find a specimen by either ID or key
export async function findSpecimen(specimenId: string): Promise<Specimen | null> {
  return Specimen.findOne({
    where: { specimenId }
  });
}

// Check if session exists by ID
export async function findSessionById(sessionId: number): Promise<any> {
  return await Session.findByPk(sessionId);
}

// Check if yoloBox exists by ID
export async function findYoloBoxById(id: number): Promise<YoloBox | null> {
  return YoloBox.findByPk(id);
}

// Common error handler
export function handleError(error: any, request: FastifyRequest, reply: FastifyReply, message: string = 'An error occurred'): void {
  request.log.error(error);
  reply.code(500).send({ error: message });
}
