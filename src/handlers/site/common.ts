import { FastifyRequest, FastifyReply } from 'fastify';
import { Site, Program, Device, Session } from '../../db/models';
// Site response format interface
export interface SiteResponse {
  siteId: number;
  programId: number;
  latitude: number | null;
  longitude: number | null;
  houseNumber: number | null;
  villageName: string | null;
}

// Helper to format site data consistently across endpoints
export function formatSiteResponse(site: Site): SiteResponse {
  return {
    siteId: site.id,
    programId: site.programId,
    latitude: site.latitude,
    longitude: site.longitude,
    houseNumber: site.houseNumber,
    villageName: site.villageName,
  };
}

// Check if site exists by ID
export async function findSiteById(siteId: number): Promise<Site | null> {
  return await Site.findByPk(siteId);
}

// Check if program exists by ID
export async function findProgramById(programId: number): Promise<Program | null> {
  return await Program.findByPk(programId);
}

// Common error handler
export function handleError(error: any, request: FastifyRequest, reply: FastifyReply, message: string = 'An error occurred'): void {
  request.log.error(error);
  reply.code(500).send({ error: message });
}

// Check if site has associated devices
export async function hasAssociatedDevices(siteId: number): Promise<boolean> {
  const deviceCount = await Device.count({
    where: { siteId },
  });
  return deviceCount > 0;
}

// Check if site has associated sessions
export async function hasAssociatedSessions(siteId: number): Promise<boolean> {
  const sessionCount = await Session.count({
    where: { siteId },
  });
  return sessionCount > 0;
}
