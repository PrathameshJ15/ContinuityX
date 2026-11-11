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
 * Loads membership directly from database (never trusts a client-sent role).
 * Returns unified 404 error if project doesn't exist OR user is not a member (prevents ID guessing).
 */
export async function requireProjectAccess(
  projectId: string,
  permission: Permission,
  explicitUserId?: string
): Promise<ProjectAccessContext> {
  let user: AuthenticatedUser;

  if (explicitUserId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: explicitUserId },
      select: { id: true, email: true, name: true },
    });
    if (!dbUser) {
      throw new UnauthorizedError("User not found.");
    }
    user = dbUser;
  } else {
    user = await requireUser();
  }

  // Check if project exists and user is a member in a single query
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
    },
  });

  // Unified response for "project does not exist" and "you are not a member" (404)
  if (!membership || !membership.project) {
    throw new ProjectNotFoundError();
  }

  // Check role against authoritative permission matrix
  if (!hasPermission(membership.role, permission)) {
    throw new ForbiddenError(
      `Role '${membership.role}' does not have permission '${permission}' on this project.`
    );
  }

  return {
    user,
    projectId,
    role: membership.role,
  };
}
