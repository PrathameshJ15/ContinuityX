// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reviewClaimService } from "@/services/reviews";
import { resolveConflictService } from "@/services/conflicts";
import { AppError, ForbiddenError, ProjectNotFoundError } from "@/lib/api-response";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    claim: { findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    verification: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    conflict: { findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    review: { create: vi.fn() },
    reviewAction: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((fn) => (typeof fn === "function" ? fn(prisma) : Promise.all(fn))),
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/services/conflicts/detection", () => ({
  claimHasOpenConflict: vi.fn(),
  detectConflictsForClaim: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/services/verification", () => ({
  verifyClaimService: vi.fn().mockResolvedValue({ status: "VERIFIED" }),
}));

describe("Phase 5 Review & Conflict Resolution Rules (Server Enforcement)", () => {
  const reviewerUser = { id: "u-rev", email: "reviewer@example.com", name: "Reviewer" };
  const viewerUser = { id: "u-view", email: "viewer@example.com", name: "Viewer" };

  const makeMembership = (userId: string, role: ProjectRole) =>
    ({
      id: `pm-${role.toLowerCase()}`,
      projectId: "proj-1",
      userId,
      role,
      joinedAt: new Date(),
      project: { id: "proj-1", status: "ACTIVE" },
    }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
    (vi.mocked(prisma.user.findUnique) as any).mockImplementation(async ({ where }: { where: { id?: string } }) => {
      if (where.id === "u-rev") return reviewerUser;
      if (where.id === "u-view") return viewerUser;
      return { id: where.id || "u-other", email: "other@example.com", name: "Other" };
    });
  });

  describe("reviewClaimService Server Rules", () => {
    it("stale version write fails with 409 Conflict (optimistic concurrency)", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(reviewerUser.id, ProjectRole.REVIEWER)
      );

      vi.mocked(prisma.claim.findFirst).mockResolvedValueOnce({
        id: "cl-1",
        projectId: "proj-1",
        version: 3, // current DB version is 3
        reviewState: "PENDING",
        verifications: [{ status: "VERIFIED" }],
      } as never);

      await expect(
        reviewClaimService({
          projectId: "proj-1",
          claimId: "cl-1",
          expectedVersion: 2, // reviewer submitted stale version 2
          decision: "ACCEPTED",
          userId: reviewerUser.id,
        })
      ).rejects.toThrow(AppError);
    });

    it("accepting a claim in an OPEN conflict fails with 400 Bad Request", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      const { claimHasOpenConflict } = await import("@/services/conflicts/detection");

      vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(reviewerUser.id, ProjectRole.REVIEWER)
      );

      vi.mocked(prisma.claim.findFirst).mockResolvedValueOnce({
        id: "cl-conflict",
        projectId: "proj-1",
        version: 1,
        reviewState: "PENDING",
        verifications: [{ status: "CONFLICTING" }],
      } as never);

      vi.mocked(claimHasOpenConflict).mockResolvedValueOnce(true);

      await expect(
        reviewClaimService({
          projectId: "proj-1",
          claimId: "cl-conflict",
          expectedVersion: 1,
          decision: "ACCEPTED",
          userId: reviewerUser.id,
        })
      ).rejects.toThrow("A claim in an OPEN conflict cannot be accepted");
    });

    it("accepting non-VERIFIED claim without written reason fails with 400", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      const { claimHasOpenConflict } = await import("@/services/conflicts/detection");

      vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(reviewerUser.id, ProjectRole.REVIEWER)
      );

      vi.mocked(prisma.claim.findFirst).mockResolvedValueOnce({
        id: "cl-weak",
        projectId: "proj-1",
        version: 1,
        reviewState: "PENDING",
        verifications: [{ status: "WEAK_SUPPORT" }],
      } as never);

      vi.mocked(claimHasOpenConflict).mockResolvedValueOnce(false);

      await expect(
        reviewClaimService({
          projectId: "proj-1",
          claimId: "cl-weak",
          expectedVersion: 1,
          decision: "ACCEPTED",
          reason: "", // Missing mandatory reason!
          userId: reviewerUser.id,
        })
      ).rejects.toThrow("requires an explicit written reason");
    });

    it("accepting non-VERIFIED claim WITH written reason succeeds and logs ReviewAction", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      const { claimHasOpenConflict } = await import("@/services/conflicts/detection");

      vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(reviewerUser.id, ProjectRole.REVIEWER)
      );

      vi.mocked(prisma.claim.findFirst).mockResolvedValueOnce({
        id: "cl-weak-ok",
        projectId: "proj-1",
        version: 1,
        reviewState: "PENDING",
        verifications: [{ status: "WEAK_SUPPORT" }],
      } as never);

      vi.mocked(claimHasOpenConflict).mockResolvedValueOnce(false);
      vi.mocked(prisma.claim.update).mockResolvedValueOnce({ id: "cl-weak-ok", reviewState: "ACCEPTED" } as never);
      vi.mocked(prisma.review.create).mockResolvedValueOnce({ id: "rev-1" } as never);

      const result = await reviewClaimService({
        projectId: "proj-1",
        claimId: "cl-weak-ok",
        expectedVersion: 1,
        decision: "ACCEPTED",
        reason: "Confirmed orally with engineering lead during sprint review.",
        userId: reviewerUser.id,
      });

      expect(result.updatedClaim.reviewState).toBe("ACCEPTED");
      expect(prisma.reviewAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: "CLAIM_ACCEPTED",
            reason: "Confirmed orally with engineering lead during sprint review.",
          }),
        })
      );
    });

    it("accepting VERIFIED claim succeeds directly without requiring reason", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      const { claimHasOpenConflict } = await import("@/services/conflicts/detection");

      vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(reviewerUser.id, ProjectRole.REVIEWER)
      );

      vi.mocked(prisma.claim.findFirst).mockResolvedValueOnce({
        id: "cl-verified",
        projectId: "proj-1",
        version: 1,
        reviewState: "PENDING",
        verifications: [{ status: "VERIFIED" }],
      } as never);

      vi.mocked(claimHasOpenConflict).mockResolvedValueOnce(false);
      vi.mocked(prisma.claim.update).mockResolvedValueOnce({ id: "cl-verified", reviewState: "ACCEPTED" } as never);
      vi.mocked(prisma.review.create).mockResolvedValueOnce({ id: "rev-2" } as never);

      const result = await reviewClaimService({
        projectId: "proj-1",
        claimId: "cl-verified",
        expectedVersion: 1,
        decision: "ACCEPTED",
        userId: reviewerUser.id,
      });

      expect(result.updatedClaim.reviewState).toBe("ACCEPTED");
    });

    it("rejecting a claim transitions state to REJECTED and records audit entry", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(reviewerUser.id, ProjectRole.REVIEWER)
      );

      vi.mocked(prisma.claim.findFirst).mockResolvedValueOnce({
        id: "cl-reject",
        projectId: "proj-1",
        version: 1,
        reviewState: "PENDING",
        verifications: [{ status: "UNKNOWN" }],
      } as never);

      vi.mocked(prisma.claim.update).mockResolvedValueOnce({ id: "cl-reject", reviewState: "REJECTED" } as never);
      vi.mocked(prisma.review.create).mockResolvedValueOnce({ id: "rev-3" } as never);
      vi.mocked(prisma.conflict.findMany).mockResolvedValueOnce([]);

      const result = await reviewClaimService({
        projectId: "proj-1",
        claimId: "cl-reject",
        expectedVersion: 1,
        decision: "REJECTED",
        comments: "Invalid specification rejected by lead.",
        userId: reviewerUser.id,
      });

      expect(result.updatedClaim.reviewState).toBe("REJECTED");
      expect(prisma.reviewAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: "CLAIM_REJECTED",
            reason: "Invalid specification rejected by lead.",
          }),
        })
      );
    });

    it("enforces role permissions: VIEWER cannot review claims (403 Forbidden)", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      vi.mocked(getCurrentUser).mockResolvedValue(viewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(viewerUser.id, ProjectRole.VIEWER)
      );

      await expect(
        reviewClaimService({
          projectId: "proj-1",
          claimId: "cl-1",
          expectedVersion: 1,
          decision: "ACCEPTED",
          userId: viewerUser.id,
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("resolveConflictService Server Rules", () => {
    it("CHOOSE_A marks claim B as REJECTED and updates conflict status", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(reviewerUser.id, ProjectRole.REVIEWER)
      );

      vi.mocked(prisma.conflict.findFirst).mockResolvedValueOnce({
        id: "conf-1",
        projectId: "proj-1",
        attributeKey: "status",
        claimAId: "cl-a",
        claimBId: "cl-b",
        status: "OPEN",
        claimA: { id: "cl-a", reviewState: "PENDING" },
        claimB: { id: "cl-b", reviewState: "PENDING" },
      } as never);

      vi.mocked(prisma.conflict.update).mockResolvedValueOnce({
        id: "conf-1",
        status: "RESOLVED_ONE_ACCEPTED",
      } as never);

      const resolved = await resolveConflictService({
        projectId: "proj-1",
        conflictId: "conf-1",
        action: "CHOOSE_A",
        reason: "Claim A matches latest architecture decision doc.",
        userId: reviewerUser.id,
      });

      expect(resolved.status).toBe("RESOLVED_ONE_ACCEPTED");
      expect(prisma.claim.update).toHaveBeenCalledWith({
        where: { id: "cl-b" },
        data: { reviewState: "REJECTED" },
      });
      expect(prisma.reviewAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actionType: "CONFLICT_RESOLVED",
            reason: "Claim A matches latest architecture decision doc.",
          }),
        })
      );
    });

    it("KEEP_BOTH fails on single-valued attribute like selected_technology", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(reviewerUser.id, ProjectRole.REVIEWER)
      );

      vi.mocked(prisma.conflict.findFirst).mockResolvedValueOnce({
        id: "conf-tech",
        projectId: "proj-1",
        attributeKey: "selected_technology",
        claimAId: "cl-a",
        claimBId: "cl-b",
        status: "OPEN",
        claimA: { id: "cl-a", reviewState: "PENDING" },
        claimB: { id: "cl-b", reviewState: "PENDING" },
      } as never);

      await expect(
        resolveConflictService({
          projectId: "proj-1",
          conflictId: "conf-tech",
          action: "KEEP_BOTH",
          reason: "Both databases used",
          userId: reviewerUser.id,
        })
      ).rejects.toThrow("only permitted for 'owner' attributes");
    });

    it("enforces role permissions: VIEWER cannot resolve conflicts (403 Forbidden)", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      vi.mocked(getCurrentUser).mockResolvedValue(viewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(viewerUser.id, ProjectRole.VIEWER)
      );

      await expect(
        resolveConflictService({
          projectId: "proj-1",
          conflictId: "conf-1",
          action: "CHOOSE_A",
          reason: "Viewer attempt",
          userId: viewerUser.id,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("enforces project isolation: non-member receives unified 404 Not Found", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);

      await expect(
        resolveConflictService({
          projectId: "proj-other",
          conflictId: "conf-1",
          action: "CHOOSE_A",
          reason: "Outsider attempt",
          userId: reviewerUser.id,
        })
      ).rejects.toThrow(ProjectNotFoundError);
    });
  });
});
