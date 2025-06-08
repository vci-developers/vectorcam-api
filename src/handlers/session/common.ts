import { FastifyRequest, FastifyReply } from 'fastify';
import { Session, Site, Device, Specimen } from '../../db/models';

// Session response format interface
export interface SessionResponse {
  sessionId: number;
  deviceId: number;
  siteId: number;
  createdAt: number;
  submittedAt: number;
}

// Helper to format session data consistently across endpoints
export function formatSessionResponse(session: Session): SessionResponse {
  return {
    sessionId: session.id,
    deviceId: session.deviceId,
    siteId: session.siteId,
    createdAt: session.createdAt.getTime(),
    submittedAt: session.submittedAt.getTime(),
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

// Check if session has specimens
export async function hasSpecimens(sessionId: number): Promise<boolean> {
  const count = await Specimen.count({ where: { sessionId } });
  return count > 0;
}

// Common pagination params parser
export function getPaginationParams(query: { page?: string; size?: string }): { page: number; size: number; offset: number } {
  const page = parseInt(query.page || '1', 10);
  const size = parseInt(query.size || '10', 10);
  const offset = (page - 1) * size;
  
  return { page, size, offset };
} 