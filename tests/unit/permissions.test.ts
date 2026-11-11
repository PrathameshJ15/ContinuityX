import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PERMISSION_MATRIX,
  hasPermission,
  requireProjectAccess,
  Permission,
} from "@/lib/permissions";
import { ProjectRole } from "@prisma/client";
import { ProjectNotFoundError, ForbiddenError, UnauthorizedError } from "@/lib/api-response";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    projectMember: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

describe("Permissions Matrix (Unit Tests)", () => {
  const allRoles: ProjectRole[] = ["OWNER", "REVIEWER", "VIEWER"];
  const allPermissions = Object.keys(PERMISSION_MATRIX) as Permission[];

  // Generate tests dynamically from the constant
  allPermissions.forEach((permission) => {
    describe(`Permission '${permission}'`, () => {
      const allowedRoles = PERMISSION_MATRIX[permission];

      allRoles.forEach((role) => {
        const expected = allowedRoles.includes(role);
        it(`role ${role} should ${expected ? "HAVE" : "LACK"} permission`, () => {
          expect(hasPermission(role, permission)).toBe(expected);
        });
      });
    });
  });

  describe("Security Assertions from TECH_DESIGN.md", () => {
    it("OWNER has full permissions across all defined actions", () => {
      allPermissions.forEach((perm) => {
        expect(hasPermission("OWNER", perm)).toBe(true);
      });
    });

    it("VIEWER is restricted strictly to read-only actions", () => {
      expect(hasPermission("VIEWER", "project:read")).toBe(true);
      expect(hasPermission("VIEWER", "handover:view_approved")).toBe(true);
      expect(hasPermission("VIEWER", "qa:ask_approved")).toBe(true);

      // Mutating or sensitive actions must be forbidden for VIEWER
      expect(hasPermission("VIEWER", "project:update")).toBe(false);
      expect(hasPermission("VIEWER", "project:archive")).toBe(false);
      expect(hasPermission("VIEWER", "members:manage")).toBe(false);
      expect(hasPermission("VIEWER", "documents:upload_or_delete")).toBe(false);
      expect(hasPermission("VIEWER", "ai:run_extraction_verification")).toBe(false);
      expect(hasPermission("VIEWER", "review:claims_conflicts_entities")).toBe(false);
      expect(hasPermission("VIEWER", "handover:approve")).toBe(false);
      expect(hasPermission("VIEWER", "claims:view_unapproved")).toBe(false);
    });

    it("REVIEWER has review and approval rights but cannot manage project settings or members", () => {
      expect(hasPermission("REVIEWER", "project:read")).toBe(true);
      expect(hasPermission("REVIEWER", "documents:upload_or_delete")).toBe(true);
      expect(hasPermission("REVIEWER", "ai:run_extraction_verification")).toBe(true);
      expect(hasPermission("REVIEWER", "review:claims_conflicts_entities")).toBe(true);
      expect(hasPermission("REVIEWER", "handover:approve")).toBe(true);
      expect(hasPermission("REVIEWER", "claims:view_unapproved")).toBe(true);

      // Members and project admin restricted to OWNER
      expect(hasPermission("REVIEWER", "project:update")).toBe(false);
      expect(hasPermission("REVIEWER", "project:archive")).toBe(false);
      expect(hasPermission("REVIEWER", "members:manage")).toBe(false);
    });
  });

  describe("requireProjectAccess enforcement", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("throws ProjectNotFoundError (404) if user is not a project member", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: "user-b",
        email: "user-b@example.com",
        name: "User B",
      });

      // DB returns null for membership
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValueOnce(null);

      await expect(
        requireProjectAccess("project-a", "project:read")
      ).rejects.toThrow(ProjectNotFoundError);
    });

    it("throws ForbiddenError (403) if user is a member but lacks permission", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: "user-viewer",
        email: "viewer@example.com",
        name: "Viewer User",
      });

      // Member exists with VIEWER role
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValueOnce({
        id: "membership-1",
        projectId: "proj-123",
        userId: "user-viewer",
        role: "VIEWER",
        joinedAt: new Date(),
        project: {
          id: "proj-123",
          status: "ACTIVE",
        },
      } as any);

      // Attempting to perform OWNER action
      await expect(
        requireProjectAccess("proj-123", "members:manage")
      ).rejects.toThrow(ForbiddenError);
    });

    it("succeeds and returns access context when role has permission", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: "user-owner",
        email: "owner@example.com",
        name: "Owner User",
      });

      vi.mocked(prisma.projectMember.findUnique).mockResolvedValueOnce({
        id: "membership-1",
        projectId: "proj-123",
        userId: "user-owner",
        role: "OWNER",
        joinedAt: new Date(),
        project: {
          id: "proj-123",
          status: "ACTIVE",
        },
      } as any);

      const context = await requireProjectAccess("proj-123", "members:manage");
      expect(context.role).toBe("OWNER");
      expect(context.projectId).toBe("proj-123");
      expect(context.user.id).toBe("user-owner");
    });
  });
});
