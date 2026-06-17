import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getExportPathAuthRequirement,
  isExportReportPath,
  verifySignedExportUrl,
} from '../services/signedUrl.service';
import { requireAdminOrSuperAdminAuth, requireSuperAdmin } from './auth.middleware';
import { requireSiteReadAccess } from './siteAccess.middleware';

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

  if (!isExportReportPath(pathname)) {
    return;
  }

  const signature = request.query as Record<string, unknown> | undefined;
  if (!signature || !('signature' in signature)) {
    return;
  }

  if (verifySignedExportUrl(pathname, signature)) {
    request.isSignedUrl = true;
  }
}

export async function requireExportAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.isSignedUrl) {
    return;
  }

  const pathname = request.url.split('?')[0];
  const authRequirement = getExportPathAuthRequirement(pathname);

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
