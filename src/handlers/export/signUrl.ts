import { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildAbsoluteSignedUrl,
  getExportPathAuthRequirement,
  isSignedUrlConfigured,
  parseExportPath,
  signExportUrl,
} from '../../services/signedUrl.service';

export const schema = {
  tags: ['Export'],
  description: 'Sign an export or report URL for temporary unauthenticated access',
  body: {
    type: 'object',
    required: ['path'],
    properties: {
      path: {
        type: 'string',
        description: 'Export or report path with optional query string, e.g. /sessions/export/csv?startDate=123',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        expiresAt: { type: 'number' },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    401: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    403: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    503: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
};

export interface SignExportUrlRequest {
  Body: {
    path: string;
  };
}

function hasAdminOrSuperAdminAccess(request: FastifyRequest): boolean {
  const isDeveloperUser = request.authType === 'user' && !!request.user?.isDeveloper;
  const isSuperAdminUser = request.authType === 'user' && !!request.user && request.user.privilege >= 3;

  return Boolean(request.isAdminToken || isDeveloperUser || isSuperAdminUser);
}

function hasSiteReadAccess(request: FastifyRequest): boolean {
  return Boolean(request.siteAccess?.canRead);
}

export async function signExportUrlHandler(
  request: FastifyRequest<SignExportUrlRequest>,
  reply: FastifyReply
): Promise<void> {
  if (!isSignedUrlConfigured()) {
    return reply.code(503).send({ error: 'Signed URL signing is not configured' });
  }

  if (request.authType === 'none') {
    return reply.code(401).send({ error: 'Unauthorized: Authentication required' });
  }

  const { path } = request.body;
  if (!path?.trim()) {
    return reply.code(400).send({ error: 'Path is required' });
  }

  let parsedPath: ReturnType<typeof parseExportPath>;
  try {
    parsedPath = parseExportPath(path);
  } catch {
    return reply.code(400).send({ error: 'Invalid path format' });
  }

  const authRequirement = getExportPathAuthRequirement(parsedPath.pathname);
  if (!authRequirement) {
    return reply.code(400).send({ error: 'Path is not an allowed export or report endpoint' });
  }

  if (authRequirement === 'adminOrSuperAdmin' && !hasAdminOrSuperAdminAccess(request)) {
    return reply.code(403).send({ error: 'Forbidden: Admin, developer, or superadmin authentication required' });
  }

  if (authRequirement === 'siteRead' && !hasSiteReadAccess(request)) {
    return reply.code(403).send({ error: 'Forbidden: Insufficient permissions to read site data' });
  }

  try {
    const signed = signExportUrl(parsedPath.pathname, parsedPath.query);
    return reply.send({
      url: buildAbsoluteSignedUrl(signed.pathname, signed.query, signed.signature),
      expiresAt: signed.expiresAt,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to sign export URL' });
  }
}
