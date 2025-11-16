import { FastifyRequest, FastifyReply } from 'fastify';
import { Session, Site, Device, Specimen } from '../../db/models';

// Session response format interface
export interface SessionResponse {
  sessionId: number;
  frontendId: string;
  collectorTitle: string | null;
  collectorName: string | null;
  collectionDate: number | null;
  collectionMethod: string | null;
  specimenCondition: string | null;
  createdAt: number | null;
  completedAt: number | null;
  submittedAt: number;
  notes: string | null;
  siteId: number;
  deviceId: number;
  // Add new fields
  latitude: number | null;
  longitude: number | null;
  type: string;
  collectorLastTrainedOn: number | null;
  hardwareId: string | null;
}

// Helper to format session data consistently across endpoints
export function formatSessionResponse(session: Session): SessionResponse {
  return {
    sessionId: session.id,
    frontendId: session.frontendId,
    collectorTitle: session.collectorTitle,
    collectorName: session.collectorName,
    collectionDate: session.collectionDate ? session.collectionDate.getTime() : null,
    collectionMethod: session.collectionMethod,
    specimenCondition: session.specimenCondition,
    createdAt: session.createdAt ? session.createdAt.getTime() : null,
    completedAt: session.completedAt ? session.completedAt.getTime() : null,
    submittedAt: session.submittedAt.getTime(),
    notes: session.notes,
    siteId: session.siteId,
    deviceId: session.deviceId,
    latitude: session.latitude,
    longitude: session.longitude,
    type: session.type,
    collectorLastTrainedOn: session.collectorLastTrainedOn ? session.collectorLastTrainedOn.getTime() : null,
    hardwareId: session.hardwareId,
  };
}

// Check if session exists by ID
export async function findSessionById(sessionId: number): Promise<Session | null> {
  return await Session.findByPk(sessionId);
}

// Check if site exists by ID
export async function findSiteById(siteId: number): Promise<Site | null> {
  return await Site.findByPk(siteId);
}

// Check if device exists by ID
export async function findDeviceById(deviceId: number): Promise<Device | null> {
  return await Device.findByPk(deviceId);
}

// Common error handler
export function handleError(error: any, request: FastifyRequest, reply: FastifyReply, message: string = 'An error occurred'): void {
  request.log.error(error);
  reply.code(500).send({ error: message });
}

// Check if session has associated specimens
export async function hasSpecimens(sessionId: number): Promise<boolean> {
  const specimenCount = await Specimen.count({
    where: { sessionId },
  });
  return specimenCount > 0;
}

// Get pagination parameters from request
export function getPaginationParams(query: { page?: string; size?: string }): { page: number; size: number; offset: number } {
  const page = parseInt(query.page || '1', 10);
  const size = parseInt(query.size || '10', 10);
  const offset = (page - 1) * size;
  return { page, size, offset };
}

export function isValidId(id: string): boolean {
  return !isNaN(Number(id)) && Number(id) > 0;
}

export async function findSession(
  id: string,
  include?: any
): Promise<Session | null> {
  // If the id is a valid number, try to find by numeric id first
  if (isValidId(id)) {
    const session = await Session.findByPk(Number(id), { include });
    if (session) return session;
  }
  
  // If not found by numeric id or id is not a number, try to find by frontendId
  return Session.findOne({
    where: { frontendId: id },
    include
  });
} 

export async function findSessionSpecimen(sessionId: number, specimenId: string, include?: any): Promise<Specimen | null> {
  const specimen = await Specimen.findOne({
    where: { sessionId, specimenId },
    include
  })
  if (specimen) return specimen;
  
  if (isValidId(specimenId)) {
    const specimen = await Specimen.findOne({
      where: { id: Number(specimenId), sessionId },
      include
    });
    if (specimen) return specimen;
  }

  return null;
}