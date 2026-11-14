import { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ProjectNotFoundError, ForbiddenError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

export type Permission =
  | "project:create"
  | "project:read"
  | "project:update"
  | "project:archive"
  | "members:manage"
  | "documents:upload_or_delete"
  | "ai:run_extraction_verification"
  | "review:claims_conflicts_entities"
  | "handover:approve"
  | "claims:view_unapproved"
  | "handover:view_approved"
  | "qa:ask_approved";

/**
 * Authoritative Project Role Permission Matrix
 * Defined as ONE typed constant so tests can be generated directly from it.
 * Source: TECH_DESIGN.md "Roles and permissions (MVP)"
 */
export const PERMISSION_MATRIX: Record<Permission, readonly ProjectRole[]> = {
  "project:create": ["OWNER", "REVIEWER", "VIEWER"],
  "project:read": ["OWNER", "REVIEWER", "VIEWER"],
  "project:update": ["OWNER"],
  "project:archive": ["OWNER"],
  "members:manage": ["OWNER"],
  "documents:upload_or_delete": ["OWNER", "REVIEWER"],
  "ai:run_extraction_verification": ["OWNER", "REVIEWER"],
  "review:claims_conflicts_entities": ["OWNER", "REVIEWER"],
  "handover:approve": ["OWNER", "REVIEWER"],
  "claims:view_unapproved": ["OWNER", "REVIEWER"],
  "handover:view_approved": ["OWNER", "REVIEWER", "VIEWER"],
  "qa:ask_approved": ["OWNER", "REVIEWER", "VIEWER"],
} as const;

export function hasPermission(role: ProjectRole, permission: Permission): boolean {
  const allowedRoles = PERMISSION_MATRIX[permission];
  return allowedRoles ? allowedRoles.includes(role) : false;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface ProjectAccessContext {
  user: AuthenticatedUser;
  projectId: string;
  role: ProjectRole;
}

// In-memory access cache to prevent concurrent request stampedes to remote database
interface CachedAccessEntry {
  context: ProjectAccessContext;
  expiresAt: number;
}

const globalForPermissions = globalThis as unknown as {
  continuityAccessCache?: Map<string, CachedAccessEntry>;
};

const accessCache =
  globalForPermissions.continuityAccessCache ?? new Map<string, CachedAccessEntry>();
globalForPermissions.continuityAccessCache = accessCache;

export function invalidateAccessCache(projectId?: string, userId?: string) {
  if (!projectId && !userId) {
    accessCache.clear();
    return;
  }
  for (const [key] of accessCache.entries()) {
    if (projectId && key.includes(projectId)) {
      accessCache.delete(key);
    } else if (userId && key.startsWith(`${userId}:`)) {
      accessCache.delete(key);
    }
  }
}

/**
 * Validates that a user is signed in server-side.
 * Never trusts client-reported authentication state.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError("You must be signed in to perform this action.");
  }
  return user;
}

/**
 * Enforces project access and role permissions strictly server-side.
 * Loads membership directly from database.
 * Employs an in-memory cache (30s TTL) to prevent repeated remote DB round-trips
 * when multiple endpoints fire concurrently on page load.
 * Returns unified 404 error if project doesn't exist OR user is not a member.
 */
export async function requireProjectAccess(
  projectId: string,
  permission: Permission,
  explicitUserId?: string
): Promise<ProjectAccessContext> {
  const user = explicitUserId
    ? { id: explicitUserId, name: "Project Member", email: "" }
    : await requireUser();

  const cacheKey = `${user.id}:${projectId}`;
  const now = Date.now();
  const cached = accessCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    if (!hasPermission(cached.context.role, permission)) {
      throw new ForbiddenError(
        `Role '${cached.context.role}' does not have permission '${permission}' on this project.`
      );
    }
    return cached.context;
  }

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: user.id,
      },
    },
    include: {
      project: {
        select: {
          id: true,
          status: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!membership || !membership.project) {
    throw new ProjectNotFoundError();
  }

  if (!hasPermission(membership.role, permission)) {
    throw new ForbiddenError(
      `Role '${membership.role}' does not have permission '${permission}' on this project.`
    );
  }

  const resolvedUser: AuthenticatedUser = (membership as { user?: AuthenticatedUser }).user ?? user;

  const context: ProjectAccessContext = {
    user: resolvedUser,
    projectId,
    role: membership.role,
  };

  // Only cache in non-test / production mode or with 15s TTL
  if (process.env.NODE_ENV !== "test") {
    accessCache.set(cacheKey, {
      context,
      expiresAt: now + 15000,
    });
  }

  return context;
}
