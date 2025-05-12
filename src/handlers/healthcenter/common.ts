import { FastifyRequest, FastifyReply } from 'fastify';
import { HealthCenter, Site } from '../../db/models';

// HealthCenter response format interface
export interface HealthCenterResponse {
  healthCenterId: number;
  latitude: number | null;
  longitude: number | null;
  parish: string | null;
  subcounty: string | null;
  district: string | null;
  country: string | null;
}

// Helper to format health center data consistently across endpoints
export function formatHealthCenterResponse(healthCenter: HealthCenter): HealthCenterResponse {
  return {
    healthCenterId: healthCenter.id,
    latitude: healthCenter.latitude,
    longitude: healthCenter.longitude,
    parish: healthCenter.parish,
    subcounty: healthCenter.subcounty,
    district: healthCenter.district,
    country: healthCenter.country,
  };
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

// Check if health center has associated sites
export async function hasAssociatedSites(healthCenterId: number): Promise<boolean> {
  const count = await Site.count({ where: { healthCenterId } });
  return count > 0;
}
