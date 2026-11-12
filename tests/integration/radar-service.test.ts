// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  computeRadarAlertsService,
  dismissRadarAlertService,
  reactivateRadarAlertService,
} from "@/services/radar";
import { BadRequestError, ForbiddenError, ProjectNotFoundError } from "@/lib/api-response";

vi.mock("@/lib/db", () => ({
  prisma: {
    claim: { findMany: vi.fn() },
    entity: { findMany: vi.fn() },
    conflict: { findMany: vi.fn() },
    radarDismissal: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue({ id: "audit-radar" }),
}));

describe("Phase 7 Radar Service Integration & Audit Dismissals", () => {
  const reviewerUser = { id: "u-rev", email: "rev@example.com", name: "Bob Reviewer" };
  const viewerUser = { id: "u-view", email: "view@example.com", name: "Charlie Viewer" };
  const nonMemberUser = { id: "u-nonmember", email: "stranger@example.com", name: "Stranger" };

  const makeMembership = (userId: string, role: ProjectRole) =>
    ({
      id: `pm-${role.toLowerCase()}`,
      projectId: "proj-1",
      userId,
      role,
      joinedAt: new Date(),
      project: { id: "proj-1", name: "ContinuityX", status: "ACTIVE" },
    }) as never;

  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.user.findUnique as any).mockImplementation(async ({ where }: any) => {
      if (where.id === reviewerUser.id) return reviewerUser;
      if (where.id === viewerUser.id) return viewerUser;
      if (where.id === nonMemberUser.id) return nonMemberUser;
      return null;
    });

    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);
    vi.mocked(prisma.entity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.conflict.findMany).mockResolvedValue([]);
    vi.mocked(prisma.radarDismissal.findMany).mockResolvedValue([]);
  });

  it("persists dismissal with mandatory written justification and logs audit record", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(reviewerUser.id, "REVIEWER")
    );

    const dismissalRecord = {
      id: "d-1",
      projectId: "proj-1",
      alertKey: "R1:ent-auth",
      ruleId: "R1",
      reason: "Secondary on-call engineer shadowed Alice during onboarding.",
      dismissedById: reviewerUser.id,
      dismissedAt: new Date(),
    };

    vi.mocked(prisma.radarDismissal.upsert).mockResolvedValue(dismissalRecord as never);

    const result = await dismissRadarAlertService(
      "proj-1",
      "R1:ent-auth",
      "R1",
      "Secondary on-call engineer shadowed Alice during onboarding.",
      reviewerUser.id
    );

    expect(result).toBeDefined();
    expect(result.reason).toContain("Secondary on-call");
    expect(prisma.radarDismissal.upsert).toHaveBeenCalled();
  });

  it("rejects dismissal if written reason is empty (HTTP 400)", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(reviewerUser.id, "REVIEWER")
    );

    await expect(
      dismissRadarAlertService("proj-1", "R1:ent-auth", "R1", "   ", reviewerUser.id)
    ).rejects.toThrow(BadRequestError);
  });

  it("reactivates a dismissed alert by deleting the dismissal record", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(reviewerUser.id, "REVIEWER")
    );

    vi.mocked(prisma.radarDismissal.findUnique).mockResolvedValue({
      id: "d-1",
      projectId: "proj-1",
      alertKey: "R1:ent-auth",
      ruleId: "R1",
    } as never);

    vi.mocked(prisma.radarDismissal.delete).mockResolvedValue({} as never);

    const result = await reactivateRadarAlertService("proj-1", "R1:ent-auth", reviewerUser.id);
    expect(result.success).toBe(true);
    expect(prisma.radarDismissal.delete).toHaveBeenCalled();
  });

  it("enforces permission matrix: VIEWER cannot dismiss alerts (403 Forbidden)", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(viewerUser.id, "VIEWER")
    );

    await expect(
      dismissRadarAlertService("proj-1", "R1:ent-auth", "R1", "Risk accepted", viewerUser.id)
    ).rejects.toThrow(ForbiddenError);
  });

  it("enforces cross-project isolation: non-member receives 404 Not Found", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);

    await expect(
      computeRadarAlertsService("proj-1", nonMemberUser.id)
    ).rejects.toThrow(ProjectNotFoundError);
  });
});
