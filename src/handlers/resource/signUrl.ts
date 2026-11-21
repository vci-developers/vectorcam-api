import { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildAbsoluteSignedUrl,
  getResourcePathPermission,
  isSignedUrlConfigured,
  parseResourcePath,
  parseSpecimenImagePath,
  signResourceUrl,
} from '../../services/signedUrl.service';
import { findSpecimenSiteId } from '../../middleware/permission.middleware';
import { restrictResourceQuery } from '../../middleware/signedUrl.middleware';

export const schema = {
  tags: ['Resources'],
  description: 'Sign a resource URL for temporary unauthenticated access',
  body: {
    type: 'object',
    required: ['path'],
    properties: {
      path: {
        type: 'string',
        description: 'Resource path with optional query string, e.g. /sessions/export/csv?startDate=123 or /specimens/1/images/456',
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

export interface SignResourceUrlRequest {
  Body: {
    path: string;
  };
}

export async function signResourceUrlHandler(
  request: FastifyRequest<SignResourceUrlRequest>,
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

  let parsedPath: ReturnType<typeof parseResourcePath>;
  try {
    parsedPath = parseResourcePath(path);
  } catch {
    return reply.code(400).send({ error: 'Invalid path format' });
  }

  const permission = getResourcePathPermission(parsedPath.pathname);
  if (!permission) {
    return reply.code(400).send({ error: 'Path is not an allowed signable resource endpoint' });
  }

  if (!request.access.has(permission)) {
    return reply.code(403).send({ error: `Forbidden: Requires ${permission} permission` });
  }

  const specimenImagePath = parseSpecimenImagePath(parsedPath.pathname);
  if (specimenImagePath) {
    const siteId = await findSpecimenSiteId(specimenImagePath.specimenId);
    if (siteId === undefined) {
      return reply.code(404).send({ error: 'Specimen not found' });
    }
    if (siteId === null) {
      return reply.code(500).send({ error: 'Internal server error: Could not determine specimen site' });
    }
    if (!(await request.access.canAccessSite(permission, siteId))) {
      return reply.code(403).send({ error: 'Forbidden: No access to this site' });
    }
  }

  const restrictionError = await restrictResourceQuery(parsedPath.pathname, parsedPath.query, request.access);
  if (restrictionError) {
    return reply.code(403).send({ error: restrictionError });
  }

  try {
    const signed = signResourceUrl(parsedPath.pathname, parsedPath.query);
    return reply.send({
      url: buildAbsoluteSignedUrl(signed.pathname, signed.query, signed.signature),
      expiresAt: signed.expiresAt,
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to sign resource URL' });
  }
}
