import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getResourcePathAuthRequirement,
  isSignablePath,
  verifySignedResourceUrl,
} from '../services/signedUrl.service';
import { requireAdminOrSuperAdminAuth, requireSuperAdmin } from './auth.middleware';
import { requireSiteReadAccess } from './siteAccess.middleware';
import { requireSpecificSpecimenReadAccess } from './specimenAccess.middleware';

declare module 'fastify' {
  interface FastifyRequest {
    isSignedUrl?: boolean;
  }
}

export async function signedUrlMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const pathname = request.url.split('?')[0];

  if (!isSignablePath(pathname)) {
    return;
  }

  const signature = request.query as Record<string, unknown> | undefined;
  if (!signature || !('signature' in signature)) {
    return;
  }

  if (verifySignedResourceUrl(pathname, signature)) {
    request.isSignedUrl = true;
  }
}

export async function requireSignedResourceAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.isSignedUrl) {
    return;
  }

  const pathname = request.url.split('?')[0];
  const authRequirement = getResourcePathAuthRequirement(pathname);

  if (authRequirement === 'specimenRead') {
    return requireSpecificSpecimenReadAccess(request, reply);
  }

  if (authRequirement === 'siteRead') {
    return requireSiteReadAccess(request, reply);
  }

  if (authRequirement === 'annotation') {
    await new Promise<void>((resolve) => {
      requireSuperAdmin(request, reply, () => resolve());
    });
    return;
  }

  await new Promise<void>((resolve) => {
    requireAdminOrSuperAdminAuth(request, reply, () => resolve());
  });
}
