// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireProjectAccess,
  hasPermission,
  PERMISSION_MATRIX,
  Permission,
} from "@/lib/permissions";
import { ProjectNotFoundError, ForbiddenError } from "@/lib/api-response";
import { sanitizeAuditMetadata } from "@/lib/audit";

vi.mock("@/lib/db", () => ({
  prisma: {
    projectMember: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

describe("Phase 9 Security, Permissions & Multi-Tenant Isolation Suite", () => {
  const ownerUser = { id: "u-owner", email: "owner@example.com", name: "Alice Owner" };
  const reviewerUser = { id: "u-reviewer", email: "reviewer@example.com", name: "Bob Reviewer" };
  const viewerUser = { id: "u-viewer", email: "viewer@example.com", name: "Charlie Viewer" };
  const nonMemberUser = { id: "u-stranger", email: "stranger@example.com", name: "Eve Stranger" };

  const makeMembership = (userId: string, role: ProjectRole, projectId = "proj-alpha") =>
    ({
      id: `pm-${role.toLowerCase()}`,
      projectId,
      userId,
      role,
      joinedAt: new Date(),
      project: { id: projectId, name: "Alpha", status: "ACTIVE" },
    }) as never;

  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.user.findUnique as any).mockImplementation(async ({ where }: any) => {
      if (where.id === ownerUser.id) return ownerUser;
      if (where.id === reviewerUser.id) return reviewerUser;
      if (where.id === viewerUser.id) return viewerUser;
      if (where.id === nonMemberUser.id) return nonMemberUser;
      return null;
    });
  });

  describe("1. Authoritative Role Permission Matrix", () => {
    it("OWNER has access to all 12 defined permissions", () => {
      const allPermissions = Object.keys(PERMISSION_MATRIX) as Permission[];
      expect(allPermissions.length).toBe(12);

      for (const perm of allPermissions) {
        expect(hasPermission("OWNER", perm)).toBe(true);
      }
    });

    it("REVIEWER is forbidden from project administration and member management", () => {
      expect(hasPermission("REVIEWER", "project:update")).toBe(false);
      expect(hasPermission("REVIEWER", "project:archive")).toBe(false);
      expect(hasPermission("REVIEWER", "members:manage")).toBe(false);

      // REVIEWER is permitted for review and documents
      expect(hasPermission("REVIEWER", "documents:upload_or_delete")).toBe(true);
      expect(hasPermission("REVIEWER", "ai:run_extraction_verification")).toBe(true);
      expect(hasPermission("REVIEWER", "review:claims_conflicts_entities")).toBe(true);
      expect(hasPermission("REVIEWER", "handover:approve")).toBe(true);
      expect(hasPermission("REVIEWER", "claims:view_unapproved")).toBe(true);
    });

    it("VIEWER has read-only access and is blocked from any write or approval operation", () => {
      // Allowed for VIEWER:
      expect(hasPermission("VIEWER", "project:read")).toBe(true);
      expect(hasPermission("VIEWER", "handover:view_approved")).toBe(true);
      expect(hasPermission("VIEWER", "qa:ask_approved")).toBe(true);

      // Blocked for VIEWER:
      expect(hasPermission("VIEWER", "documents:upload_or_delete")).toBe(false);
      expect(hasPermission("VIEWER", "ai:run_extraction_verification")).toBe(false);
      expect(hasPermission("VIEWER", "review:claims_conflicts_entities")).toBe(false);
      expect(hasPermission("VIEWER", "handover:approve")).toBe(false);
      expect(hasPermission("VIEWER", "claims:view_unapproved")).toBe(false);
      expect(hasPermission("VIEWER", "project:update")).toBe(false);
      expect(hasPermission("VIEWER", "project:archive")).toBe(false);
      expect(hasPermission("VIEWER", "members:manage")).toBe(false);
    });
  });

  describe("2. Server-Side requireProjectAccess Enforcement", () => {
    it("permits OWNER on administrative action", async () => {
      (prisma.projectMember.findUnique as any).mockResolvedValue(
        makeMembership(ownerUser.id, "OWNER")
      );

      const membership = await requireProjectAccess("proj-alpha", "members:manage", ownerUser.id);
      expect(membership.role).toBe("OWNER");
    });

    it("rejects REVIEWER on members:manage with ForbiddenError (HTTP 403)", async () => {
      (prisma.projectMember.findUnique as any).mockResolvedValue(
        makeMembership(reviewerUser.id, "REVIEWER")
      );

      await expect(
        requireProjectAccess("proj-alpha", "members:manage", reviewerUser.id)
      ).rejects.toThrow(ForbiddenError);
    });

    it("rejects VIEWER on documents:upload_or_delete with ForbiddenError (HTTP 403)", async () => {
      (prisma.projectMember.findUnique as any).mockResolvedValue(
        makeMembership(viewerUser.id, "VIEWER")
      );

      await expect(
        requireProjectAccess("proj-alpha", "documents:upload_or_delete", viewerUser.id)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("3. Zero-Enumeration & Cross-Tenant IDOR Prevention", () => {
    it("returns ProjectNotFoundError (HTTP 404) for non-members without leaking project existence", async () => {
      (prisma.projectMember.findUnique as any).mockResolvedValue(null);

      // Even if project exists, non-member receives 404, not 403
      await expect(
        requireProjectAccess("proj-alpha", "project:read", nonMemberUser.id)
      ).rejects.toThrow(ProjectNotFoundError);
    });

    it("cross-tenant isolation: user in Project Alpha cannot access Project Beta", async () => {
      (prisma.projectMember.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.projectId_userId?.projectId === "proj-alpha") {
          return makeMembership(ownerUser.id, "OWNER", "proj-alpha");
        }
        return null;
      });

      // User owns Project Alpha, tries to access Project Beta
      await expect(
        requireProjectAccess("proj-beta", "project:read", ownerUser.id)
      ).rejects.toThrow(ProjectNotFoundError);
    });
  });

  describe("4. Audit Logging Secret Redaction", () => {
    it("redacts sensitive fields (passwords, tokens, keys, secrets) in audit metadata", () => {
      const sensitiveInput = {
        userId: "u-123",
        action: "TEST_ACTION",
        password: "super-secret-password",
        apiKey: "AIzaSyD-dummy-api-key",
        bearerToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        databaseUrl: "postgresql://postgres:secret@neon.tech/db",
        nestedConfig: {
          clientSecret: "top-secret-val",
          normalField: "visible",
        },
      };

      const sanitized = sanitizeAuditMetadata(sensitiveInput);

      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.apiKey).toBe("[REDACTED]");
      expect(sanitized.bearerToken).toBe("[REDACTED]");
      expect(sanitized.databaseUrl).toBe("[REDACTED]");
      expect((sanitized.nestedConfig as any).clientSecret).toBe("[REDACTED]");
      expect((sanitized.nestedConfig as any).normalField).toBe("visible");
      expect(sanitized.userId).toBe("u-123");
    });
  });
});
