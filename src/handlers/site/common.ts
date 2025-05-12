import { FastifyRequest, FastifyReply } from 'fastify';
import { Site, HealthCenter, Device, Session } from '../../db/models';
// Site response format interface
export interface SiteResponse {
  siteId: number;
  healthCenterId: number;
  latitude: number | null;
  longitude: number | null;
  houseNumber: number | null;
  villageName: string | null;
}

// Helper to format site data consistently across endpoints
export function formatSiteResponse(site: Site): SiteResponse {
  return {
    siteId: site.id,
    healthCenterId: site.healthCenterId,
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

// Check if health center exists by ID
export async function findHealthCenterById(healthCenterId: number): Promise<HealthCenter | null> {
  return await HealthCenter.findByPk(healthCenterId);
}

// Common error handler
export function handleError(error: any, request: FastifyRequest, reply: FastifyReply, message: string = 'An error occurred'): void {
  request.log.error(error);
  reply.code(500).send({ error: message });
}

// Check if site has associated devices
export async function hasAssociatedDevices(siteId: number): Promise<boolean> {
  const count = await Device.count({ where: { siteId } });
  return count > 0;
}

// Check if site has associated sessions
export async function hasAssociatedSessions(siteId: number): Promise<boolean> {
  const count = await Session.count({ where: { siteId } });
  return count > 0;
}
