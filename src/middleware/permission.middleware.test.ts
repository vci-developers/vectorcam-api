import { requirePermission, siteOfSession } from './permission.middleware';
import { AccessContext } from '../services/accessContext';
import { Session } from '../db/models';
import { assignedSitesAccess, unrestrictedAccess } from '../test/access';

jest.mock('../db/models', () => ({
  Session: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Specimen: {
    findByPk: jest.fn(),
  },
}));

function createReply() {
  const reply: any = {
    statusCode: undefined as number | undefined,
    payload: undefined as unknown,
  };
  reply.code = jest.fn((code: number) => {
    reply.statusCode = code;
    return reply;
  });
  reply.send = jest.fn((payload: unknown) => {
    reply.payload = payload;
    return reply;
  });
  return reply;
}

function userRequest(access: AccessContext, params: Record<string, unknown> = {}, isWhitelisted = true): any {
  return {
    authType: 'user',
    user: { id: 7, email: 'user@example.com', isWhitelisted, isDeveloper: false, programId: 1 },
    access,
    params,
  };
}

describe('requirePermission', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const reply = createReply();
    await requirePermission('site:read')({ authType: 'none', access: AccessContext.none() } as any, reply);

    expect(reply.statusCode).toBe(401);
  });

  it('returns 403 for users who are not whitelisted', async () => {
    const reply = createReply();
    await requirePermission('site:read')(userRequest(unrestrictedAccess(), {}, false), reply);

    expect(reply.statusCode).toBe(403);
  });

  it('returns 403 when the permission is missing', async () => {
    const reply = createReply();
    await requirePermission('dhis2:push')(userRequest(AccessContext.unrestricted(['site:read'])), reply);

    expect(reply.statusCode).toBe(403);
    expect(reply.payload).toEqual({ error: 'Forbidden: Requires dhis2:push permission' });
  });

  it('passes when any of several permissions is held', async () => {
    const reply = createReply();
    await requirePermission(['annotation:read', 'annotation:manage'])(
      userRequest(AccessContext.unrestricted(['annotation:manage'])),
      reply
    );

    expect(reply.code).not.toHaveBeenCalled();
  });

  it('checks the targeted site against the permission scope', async () => {
    const siteFromParams = jest.fn(async (request: any) => Number(request.params.site_id));
    const guard = requirePermission('site:write', { site: siteFromParams });

    const allowed = createReply();
    await guard(userRequest(assignedSitesAccess([10, 11]), { site_id: '11' }), allowed);
    expect(allowed.code).not.toHaveBeenCalled();

    const denied = createReply();
    await guard(userRequest(assignedSitesAccess([10, 11]), { site_id: '12' }), denied);
    expect(denied.statusCode).toBe(403);
  });

  it('skips the site lookup for unrestricted callers', async () => {
    const resolver = jest.fn();
    const reply = createReply();
    await requirePermission('session:write', { site: resolver })(userRequest(unrestrictedAccess()), reply);

    expect(resolver).not.toHaveBeenCalled();
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('enforces the program in the URL', async () => {
    const guard = requirePermission('program:forms', { programParam: 'program_id' });
    const access = AccessContext.forUser({
      programId: 1,
      grants: [{ permission: 'program:forms', scope: 'program' }],
      assignedSiteIds: [],
      loadSiteIds: async () => [],
    });

    const ownProgram = createReply();
    await guard(userRequest(access, { program_id: '1' }), ownProgram);
    expect(ownProgram.code).not.toHaveBeenCalled();

    const otherProgram = createReply();
    await guard(userRequest(access, { program_id: '2' }), otherProgram);
    expect(otherProgram.statusCode).toBe(403);
  });
});

describe('siteOfSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves sessions by numeric id', async () => {
    (Session.findByPk as jest.Mock).mockResolvedValue({ siteId: 4 });

    await expect(siteOfSession({ params: { session_id: '12' } } as any, createReply())).resolves.toBe(4);
    expect(Session.findByPk).toHaveBeenCalledWith(12);
  });

  it('falls back to frontendId', async () => {
    (Session.findOne as jest.Mock).mockResolvedValue({ siteId: 5 });

    await expect(siteOfSession({ params: { session_id: 'abc-123' } } as any, createReply())).resolves.toBe(5);
    expect(Session.findOne).toHaveBeenCalledWith({ where: { frontendId: 'abc-123' } });
  });

  it('replies 404 for unknown sessions', async () => {
    (Session.findByPk as jest.Mock).mockResolvedValue(null);
    (Session.findOne as jest.Mock).mockResolvedValue(null);
    const reply = createReply();

    await expect(siteOfSession({ params: { session_id: '12' } } as any, reply)).resolves.toBeNull();
    expect(reply.statusCode).toBe(404);
  });
});
