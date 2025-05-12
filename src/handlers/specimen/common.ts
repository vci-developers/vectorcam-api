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
  thumbnailUrl: string | null;
  thumbnailImageId: number | null;
  images: Array<{
    id: number;
    url: string;
  }>;
  yoloBox?: {
    yoloBoxId: number;
    topLeftX: number;
    topLeftY: number;
    width: number;
    height: number;
  } | null;
}

// Helper to format specimen data consistently across endpoints
export async function formatSpecimenResponse(specimen: Specimen): Promise<SpecimenResponse> {
  const yoloBox = specimen.yoloBoxId ? await YoloBox.findByPk(specimen.yoloBoxId) : null;
  
  // Get all images for this specimen
  const images = await SpecimenImage.findAll({
    where: { specimenId: specimen.id },
    order: [['created_at', 'DESC']]
  });

  // Format the images
  const formattedImages = images.map(img => ({
    id: img.id,
    url: `/specimens/${specimen.specimenId}/images/${img.id}`
  }));

  // Get the thumbnail URL
  let thumbnailUrl = null;
  if (specimen.thumbnailImageId) {
    const thumbnail = images.find(img => img.id === specimen.thumbnailImageId);
    if (thumbnail) {
      thumbnailUrl = `/specimens/${specimen.specimenId}/images/${thumbnail.id}`;
    }
  }
  
  return {
    id: specimen.id,
    specimenId: specimen.specimenId,
    sessionId: specimen.sessionId,
    species: specimen.species,
    sex: specimen.sex,
    abdomenStatus: specimen.abdomenStatus,
    thumbnailUrl,
    thumbnailImageId: specimen.thumbnailImageId,
    images: formattedImages,
    yoloBox: yoloBox ? {
      yoloBoxId: yoloBox.id,
      topLeftX: yoloBox.topLeftX,
      topLeftY: yoloBox.topLeftY,
      width: yoloBox.width,
      height: yoloBox.height,
    } : null,
  };
}

// Helper function to determine if a string is a valid numeric ID
export function isValidId(id: string): boolean {
  return !isNaN(Number(id)) && Number(id) > 0;
}

// Helper function to find a specimen by either ID or key
export async function findSpecimen(id: string): Promise<Specimen | null> {
  if (isValidId(id)) {
    return await Specimen.findByPk(id);
  } else {
    return await Specimen.findOne({ where: { specimenId: id } });
  }
}

// Check if session exists by ID
export async function findSessionById(sessionId: number): Promise<any> {
  return await Session.findByPk(sessionId);
}

// Check if yoloBox exists by ID
export async function findYoloBoxById(yoloBoxId: number): Promise<any> {
  return await YoloBox.findByPk(yoloBoxId);
}

// Common error handler
export function handleError(error: any, request: FastifyRequest, reply: FastifyReply, message: string = 'An error occurred'): void {
  request.log.error(error);
  reply.code(500).send({ error: message });
}
