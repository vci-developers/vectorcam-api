import { FastifyRequest } from 'fastify';
import { UserAuthEvent } from '../db/models';
import { UserAuthEventType } from '../db/models/UserAuthEvent';

export interface UserAuthEventInput {
  userId: number;
  eventType: UserAuthEventType;
  request?: FastifyRequest;
  metadata?: Record<string, unknown> | null;
}

function getClientIp(request: FastifyRequest): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return request.ip ?? null;
}

function getUserAgent(request: FastifyRequest): string | null {
  const userAgent = request.headers['user-agent'];
  if (typeof userAgent !== 'string' || userAgent.length === 0) {
    return null;
  }
  return userAgent.slice(0, 512);
}

export async function logUserAuthEvent(input: UserAuthEventInput): Promise<void> {
  await UserAuthEvent.create({
    userId: input.userId,
    eventType: input.eventType,
    ipAddress: input.request ? getClientIp(input.request) : null,
    userAgent: input.request ? getUserAgent(input.request) : null,
    metadata: input.metadata ?? null,
  });
}
