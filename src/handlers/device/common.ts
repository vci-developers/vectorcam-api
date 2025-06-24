import { FastifyRequest, FastifyReply } from 'fastify';
import { Device, Program, Session } from '../../db/models';

// Device response format interface
export interface DeviceResponse {
  deviceId: number;
  model: string;
  registeredAt: number; // Unix timestamp in milliseconds
  programId: number;
  submittedAt: number; // Unix timestamp in milliseconds
}

// Helper to format device data consistently across endpoints
export function formatDeviceResponse(device: Device): DeviceResponse {
  return {
    deviceId: device.id,
    model: device.model,
    registeredAt: device.registeredAt.getTime(), // Convert Date to Unix timestamp in milliseconds
    programId: device.programId,
    submittedAt: device.createdAt.getTime(),
  };
}

// Check if device exists by ID
export async function findDeviceById(deviceId: number): Promise<Device | null> {
  return await Device.findByPk(deviceId);
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

// Check if device has associated sessions
export async function hasAssociatedSessions(deviceId: number): Promise<boolean> {
  const sessionCount = await Session.count({
    where: { deviceId },
  });
  return sessionCount > 0;
}
