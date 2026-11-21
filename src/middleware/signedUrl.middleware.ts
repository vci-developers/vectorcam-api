import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getResourcePathPermission,
  isSignablePath,
  isSpecimenImagePath,
  PROGRAM_SCOPED_RESOURCE_PATHS,
  verifySignedResourceUrl,
} from '../services/signedUrl.service';
import { AccessContext } from '../services/accessContext';
import { parseSiteIds } from '../handlers/site/common';
import { requirePermission, siteOfSpecimen } from './permission.middleware';

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

/**
 * Narrows an export's query to what the caller may see: the caller's program, and for
 * the session report, the caller's sites when they only read assigned sites.
 * Mutates `query`. Returns an error message when the requested filters exceed access.
 */
export async function restrictResourceQuery(
  pathname: string,
  query: Record<string, unknown>,
  access: AccessContext
): Promise<string | null> {
  if (!PROGRAM_SCOPED_RESOURCE_PATHS.has(pathname) || access.allPrograms) {
    return null;
  }
  if (access.programId === null) {
    return 'Forbidden: User program not configured';
  }

  const requestedProgramId = query.programId;
  if (
    requestedProgramId !== undefined &&
    requestedProgramId !== null &&
    requestedProgramId !== '' &&
    Number(requestedProgramId) !== access.programId
  ) {
    return 'Forbidden: Cannot export data from another program';
  }
  query.programId = String(access.programId);

  if (pathname === '/sessions/report' && access.scopeOf('session:read') === 'assigned_sites') {
    const allowedSiteIds = new Set((await access.siteIdsFor('session:read')) ?? []);
    const requestedSiteIds = parseSiteIds(typeof query.siteIds === 'string' ? query.siteIds : undefined);
    if (requestedSiteIds.length > 0) {
      if (requestedSiteIds.some((siteId) => !allowedSiteIds.has(siteId))) {
        return 'Forbidden: No access to one or more requested sites';
      }
    } else {
      query.siteIds = access.assignedSiteIds.join(',');
    }
  }

  return null;
}

export async function requireSignedResourceAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.isSignedUrl) {
    return;
  }

  const pathname = request.url.split('?')[0];
  const permission = getResourcePathPermission(pathname);
  if (!permission) {
    return reply.code(403).send({ error: 'Forbidden: Path is not a signable resource' });
  }

  const guard = requirePermission(permission, isSpecimenImagePath(pathname) ? { site: siteOfSpecimen } : {});
  await guard(request, reply);
  if (reply.sent) {
    return;
  }

  const error = await restrictResourceQuery(pathname, request.query as Record<string, unknown>, request.access);
  if (error) {
    return reply.code(403).send({ error });
  }
}
