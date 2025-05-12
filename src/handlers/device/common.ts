import { FastifyRequest, FastifyReply } from 'fastify';
import { Device, Site, Session } from '../../db/models';

// Device response format interface
export interface DeviceResponse {
  deviceId: number;
  siteId: number;
}

// Helper to format device data consistently across endpoints
export function formatDeviceResponse(device: Device): DeviceResponse {
  return {
    deviceId: device.id,
    siteId: device.siteId,
  };
}

// Check if device exists by ID
export async function findDeviceById(deviceId: number): Promise<Device | null> {
  return await Device.findByPk(deviceId);
}

// Check if site exists by ID
export async function findSiteById(siteId: number): Promise<Site | null> {
  return await Site.findByPk(siteId);
}

// Common error handler
export function handleError(error: any, request: FastifyRequest, reply: FastifyReply, message: string = 'An error occurred'): void {
  request.log.error(error);
  reply.code(500).send({ error: message });
}

// Check if device has associated sessions
export async function hasAssociatedSessions(deviceId: number): Promise<boolean> {
  const count = await Session.count({ where: { deviceId } });
  return count > 0;
}
