// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyClaimService, verifyAllProjectClaimsService } from "@/services/verification";
import { LLMProvider } from "@/lib/ai/provider";
import { ForbiddenError, ProjectNotFoundError } from "@/lib/api-response";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    claim: { findFirst: vi.fn(), findMany: vi.fn() },
    verification: { create: vi.fn(), findMany: vi.fn() },
    conflict: { findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

describe("Phase 4 Verification Service (Integration & Authorization)", () => {
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

  const mockClaimValid = {
    id: "claim-1",
    projectId: "proj-1",
    subjectEntityId: "ent-1",
    attributeKey: "status",
    valueRaw: "COMPLETED",
    valueNormalized: "COMPLETED",
    category: "TASK",
    reviewState: "PENDING",
    subjectEntity: {
      id: "ent-1",
      canonicalName: "Camera Calibration",
      aliases: [{ alias: "CamCal" }],
    },
    evidence: [
      {
        id: "ev-1",
        excerpt: "Camera Calibration subsystem testing is COMPLETED and ready for deployment.",
        sourceLocation: "Page 2, Section 4",
        document: {
          id: "doc-1",
          fileName: "camera_spec.pdf",
          deletedAt: null,
          sourceDate: new Date("2026-03-01"),
          sourceDateBasis: "USER_PROVIDED",
        },
        chunk: {
          id: "chk-1",
          chunkIndex: 1,
          content: "Camera Calibration subsystem testing is COMPLETED and ready for deployment without open defects.",
          sectionTitle: "Testing",
          pageNumber: 2,
          rowStart: null,
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);
    (vi.mocked(prisma.user.findUnique) as any).mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id === "u-rev") return reviewerUser;
      if (where.id === "u-view") return viewerUser;
      return { id: where.id || "u-other", email: "other@example.com", name: "Other" };
    });
  });

  it("enforces role permissions: VIEWER cannot run verification (403 Forbidden)", async () => {
    const { prisma } = await import("@/lib/db");
    const { getCurrentUser } = await import("@/lib/auth");

    vi.mocked(getCurrentUser).mockResolvedValue(viewerUser);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(viewerUser.id, ProjectRole.VIEWER)
    );

    await expect(
      verifyClaimService("proj-1", "claim-1", { userId: viewerUser.id })
    ).rejects.toThrow(ForbiddenError);
  });

  it("enforces project isolation: non-member receives unified 404", async () => {
    const { prisma } = await import("@/lib/db");
    const { getCurrentUser } = await import("@/lib/auth");

    vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);

    await expect(
      verifyClaimService("proj-unknown", "claim-1", { userId: reviewerUser.id })
    ).rejects.toThrow(ProjectNotFoundError);
  });

  it("verifies claim successfully to VERIFIED when all 4 gates pass", async () => {
    const { prisma } = await import("@/lib/db");
    const { getCurrentUser } = await import("@/lib/auth");

    vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(reviewerUser.id, ProjectRole.REVIEWER)
    );
    vi.mocked(prisma.claim.findFirst).mockResolvedValue(mockClaimValid as never);
    vi.mocked(prisma.conflict.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.conflict.count).mockResolvedValue(0);
    vi.mocked(prisma.verification.create).mockResolvedValue({
      id: "ver-1",
      claimId: "claim-1",
      status: "VERIFIED",
    } as never);

    const mockLLM: LLMProvider = {
      name: "mock-judge",
      generateStructuredText: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          outcome: "SUPPORTS",
          reason: "Excerpt confirms camera calibration testing is completed.",
        }),
        model: "gemini-3.5-flash",
      }),
    };

    const res = await verifyClaimService("proj-1", "claim-1", {
      userId: reviewerUser.id,
      provider: mockLLM,
    });

    expect(res.status).toBe("VERIFIED");
    expect(res.ruleNumber).toBe(9);
    expect(prisma.verification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "VERIFIED",
          sourceGate: "PASS",
          quoteGate: "PASS",
          semanticGate: "SUPPORTS",
          contradictionGate: "PASS",
        }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CLAIM_VERIFIED",
          entityId: "claim-1",
        }),
      })
    );
  });

  it("maps to UNVERIFIED and skips semantic judge if source document was deleted", async () => {
    const { prisma } = await import("@/lib/db");
    const { getCurrentUser } = await import("@/lib/auth");

    const claimWithDeletedDoc = {
      ...mockClaimValid,
      evidence: [
        {
          ...mockClaimValid.evidence[0],
          document: {
            ...mockClaimValid.evidence[0].document,
            deletedAt: new Date(),
          },
        },
      ],
    };

    vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(reviewerUser.id, ProjectRole.REVIEWER)
    );
    vi.mocked(prisma.claim.findFirst).mockResolvedValue(claimWithDeletedDoc as never);
    vi.mocked(prisma.conflict.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.conflict.count).mockResolvedValue(0);
    vi.mocked(prisma.verification.create).mockResolvedValue({
      id: "ver-2",
      claimId: "claim-1",
      status: "UNVERIFIED",
    } as never);

    const mockLLM: LLMProvider = {
      name: "mock-judge",
      generateStructuredText: vi.fn(),
    };

    const res = await verifyClaimService("proj-1", "claim-1", {
      userId: reviewerUser.id,
      provider: mockLLM,
    });

    expect(res.status).toBe("UNVERIFIED");
    expect(res.ruleNumber).toBe(1);
    // Gate 3 Judge must NOT be called when Gate 1 fails
    expect(mockLLM.generateStructuredText).not.toHaveBeenCalled();
  });

  it("maps to CONFLICTING if an OPEN conflict exists even when judge returns SUPPORTS", async () => {
    const { prisma } = await import("@/lib/db");
    const { getCurrentUser } = await import("@/lib/auth");

    vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(reviewerUser.id, ProjectRole.REVIEWER)
    );
    vi.mocked(prisma.claim.findFirst).mockResolvedValue(mockClaimValid as never);
    // Simulate OPEN conflict exists
    vi.mocked(prisma.conflict.findFirst).mockResolvedValue({ id: "conf-1", status: "OPEN" } as never);
    vi.mocked(prisma.conflict.count).mockResolvedValue(1);
    vi.mocked(prisma.verification.create).mockResolvedValue({
      id: "ver-3",
      claimId: "claim-1",
      status: "CONFLICTING",
    } as never);

    const mockLLM: LLMProvider = {
      name: "mock-judge",
      generateStructuredText: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          outcome: "SUPPORTS",
          reason: "Excerpt confirms status is completed.",
        }),
        model: "gemini-3.5-flash",
      }),
    };

    const res = await verifyClaimService("proj-1", "claim-1", {
      userId: reviewerUser.id,
      provider: mockLLM,
    });

    expect(res.status).toBe("CONFLICTING");
    expect(res.ruleNumber).toBe(8);
  });
});
