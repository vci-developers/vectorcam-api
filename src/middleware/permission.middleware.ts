import { FastifyReply, FastifyRequest } from 'fastify';
import { Session, Specimen } from '../db/models';
import { Permission } from '../services/permissions';

/**
 * Resolves the site a request targets. Returns null after sending an error reply
 * (missing parameter or unknown record).
 */
export type SiteResolver = (request: FastifyRequest, reply: FastifyReply) => Promise<number | null>;

interface PermissionOptions {
  /** Require the permission on the site this request targets. */
  site?: SiteResolver;
  /** Route parameter holding a program ID the user must belong to. */
  programParam?: string;
}

function parseId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Route guard: the caller must hold at least one of the given permissions. With
 * `site`, the permission must also cover the targeted site; with `programParam`,
 * the program in the URL must be the caller's own program.
 */
export function requirePermission(permission: Permission | Permission[], options: PermissionOptions = {}) {
  const permissions = Array.isArray(permission) ? permission : [permission];

  return async function permissionGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.authType || request.authType === 'none') {
      return reply.code(401).send({ error: 'Unauthorized: Authentication required' });
    }

    if (request.authType === 'user' && !request.user?.isDeveloper && !request.user?.isWhitelisted) {
      return reply.code(403).send({ error: 'Forbidden: Account not whitelisted. Contact an administrator.' });
    }

    const access = request.access;
    const granted = permissions.filter((candidate) => access.has(candidate));
    if (granted.length === 0) {
      return reply.code(403).send({ error: `Forbidden: Requires ${permissions.join(' or ')} permission` });
    }

    if (options.programParam) {
      const programId = parseId((request.params as Record<string, unknown>)[options.programParam]);
      if (programId === null) {
        return reply.code(400).send({ error: 'Bad Request: Valid program ID is required' });
      }
      if (!access.canAccessProgram(programId)) {
        return reply.code(403).send({ error: 'Forbidden: Program access denied' });
      }
    }

    if (options.site && !granted.some((candidate) => access.scopeOf(candidate) === 'all')) {
      const siteId = await options.site(request, reply);
      if (siteId === null) {
        return;
      }
      for (const candidate of granted) {
        if (await access.canAccessSite(candidate, siteId)) {
          return;
        }
      }
      return reply.code(403).send({ error: 'Forbidden: No access to this site' });
    }
  };
}

export const siteFromParams: SiteResolver = async (request, reply) => {
  const params = request.params as Record<string, unknown>;
  const siteId = parseId(params.site_id ?? params.siteId ?? params.id);
  if (siteId === null) {
    reply.code(400).send({ error: 'Bad Request: Site ID not found in request' });
    return null;
  }
  return siteId;
};

export const siteOfSession: SiteResolver = async (request, reply) => {
  const params = request.params as Record<string, unknown>;
  const sessionId = params.session_id ?? params.sessionId ?? params.id;
  if (sessionId === undefined || sessionId === null || sessionId === '') {
    reply.code(400).send({ error: 'Bad Request: Session ID not found in request' });
    return null;
  }

  const session = await findSessionByIdOrFrontendId(sessionId as string | number);
  if (!session) {
    reply.code(404).send({ error: 'Session not found' });
    return null;
  }
  return session.siteId;
};

export const siteOfSpecimen: SiteResolver = async (request, reply) => {
  const specimenId = getSpecimenIdFromRequest(request);
  if (specimenId === null) {
    reply.code(400).send({ error: 'Bad Request: Specimen ID not found in request' });
    return null;
  }

  const siteId = await findSpecimenSiteId(specimenId);
  if (siteId === undefined) {
    reply.code(404).send({ error: 'Specimen not found' });
    return null;
  }
  if (siteId === null) {
    reply.code(500).send({ error: 'Internal server error: Could not determine specimen site' });
    return null;
  }
  return siteId;
};

export function getSpecimenIdFromRequest(request: FastifyRequest): number | null {
  const params = request.params as Record<string, unknown>;
  return parseId(params.specimen_id ?? params.specimenId ?? params.id);
}

/** Returns undefined when the specimen does not exist, null when its site is unknown. */
export async function findSpecimenSiteId(specimenId: number): Promise<number | null | undefined> {
  const specimen = await Specimen.findByPk(specimenId, {
    include: [{ model: Session, as: 'session', attributes: ['siteId'] }],
    attributes: ['id'],
  });
  if (!specimen) {
    return undefined;
  }
  const specimenData = specimen.get({ plain: true }) as { session?: { siteId?: number } };
  return specimenData.session?.siteId ?? null;
}

/**
 * Sessions can be addressed by numeric ID or by frontendId.
 */
export async function findSessionByIdOrFrontendId(sessionId: string | number): Promise<Session | null> {
  const numericId = typeof sessionId === 'number' ? sessionId : parseInt(sessionId, 10);
  if (!Number.isNaN(numericId)) {
    const session = await Session.findByPk(numericId);
    if (session || typeof sessionId === 'number') return session;
  }

  return Session.findOne({ where: { frontendId: sessionId } });
}
