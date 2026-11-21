import {
  ALL_PERMISSIONS,
  AssignmentScope,
  isGrantablePermission,
  isProgramPermission,
  Permission,
} from './permissions';

/** 'all' = every site in every program (admin token, developer users, mobile token). */
export type GrantScope = AssignmentScope | 'all';

/** Loads the site IDs covered by a scope. 'assigned_sites' must include child sites. */
export type SiteIdLoader = (scope: AssignmentScope) => Promise<number[]>;

const SCOPE_RANK: Record<GrantScope, number> = { assigned_sites: 0, program: 1, all: 2 };

export interface PermissionGrant {
  permission: Permission;
  scope: GrantScope;
}

export class AccessContext {
  private readonly siteIdCache = new Map<AssignmentScope, Promise<number[]>>();

  private constructor(
    private readonly scopes: ReadonlyMap<Permission, GrantScope>,
    /** The user's program; null for principals that are not bound to a program. */
    readonly programId: number | null,
    /** Sites the user is directly assigned to (without child sites). */
    readonly assignedSiteIds: readonly number[],
    private readonly loadSiteIds: SiteIdLoader
  ) {}

  static none(): AccessContext {
    return new AccessContext(new Map(), null, [], async () => []);
  }

  static unrestricted(permissions: readonly Permission[] = ALL_PERMISSIONS): AccessContext {
    return new AccessContext(
      new Map(permissions.map((permission) => [permission, 'all' as const])),
      null,
      [],
      async () => []
    );
  }

  /**
   * Grants come from the user's role assignments. When a permission is granted at both
   * scopes, program scope wins. Assigned-sites grants are dropped when the user has no
   * assigned sites, and program permissions are only honoured at program scope.
   */
  static forUser(input: {
    programId: number;
    grants: Iterable<{ permission: string; scope: AssignmentScope }>;
    assignedSiteIds: readonly number[];
    loadSiteIds: SiteIdLoader;
  }): AccessContext {
    const scopes = new Map<Permission, GrantScope>();
    for (const { permission, scope } of input.grants) {
      if (!isGrantablePermission(permission)) continue;
      if (scope === 'assigned_sites' && (isProgramPermission(permission) || input.assignedSiteIds.length === 0)) {
        continue;
      }
      const current = scopes.get(permission);
      if (!current || SCOPE_RANK[scope] > SCOPE_RANK[current]) {
        scopes.set(permission, scope);
      }
    }
    return new AccessContext(scopes, input.programId, input.assignedSiteIds, input.loadSiteIds);
  }

  get allPrograms(): boolean {
    return this.programId === null && this.scopes.size > 0;
  }

  has(permission: Permission): boolean {
    return this.scopes.has(permission);
  }

  hasAny(permissions: readonly Permission[]): boolean {
    return permissions.some((permission) => this.scopes.has(permission));
  }

  scopeOf(permission: Permission): GrantScope | null {
    return this.scopes.get(permission) ?? null;
  }

  grants(): PermissionGrant[] {
    return ALL_PERMISSIONS
      .filter((permission) => this.scopes.has(permission))
      .map((permission) => ({ permission, scope: this.scopes.get(permission)! }));
  }

  canAccessProgram(programId: number): boolean {
    return this.allPrograms || (this.programId !== null && this.programId === programId);
  }

  /**
   * Site IDs (including child sites) the permission covers.
   * Returns null when the permission is not restricted to any site list.
   */
  async siteIdsFor(permission: Permission): Promise<number[] | null> {
    const scope = this.scopes.get(permission);
    if (!scope) return [];
    if (scope === 'all') return null;

    let siteIds = this.siteIdCache.get(scope);
    if (!siteIds) {
      siteIds = this.loadSiteIds(scope);
      this.siteIdCache.set(scope, siteIds);
    }
    return siteIds;
  }

  async canAccessSite(permission: Permission, siteId: number): Promise<boolean> {
    const siteIds = await this.siteIdsFor(permission);
    return siteIds === null || siteIds.includes(siteId);
  }
}
