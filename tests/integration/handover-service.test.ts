// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getHandoverDraftPreviewService,
  approveHandoverService,
  getHandoverByIdService,
  verifyHandoverReceiptService,
} from "@/services/handover";
import { BadRequestError, ForbiddenError, ProjectNotFoundError } from "@/lib/api-response";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    claim: { findMany: vi.fn(), findFirst: vi.fn() },
    conflict: { findMany: vi.fn() },
    document: { findMany: vi.fn() },
    handover: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    handoverSnapshot: { create: vi.fn() },
    handoverReceipt: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (callback) => {
      if (typeof callback === "function") {
        return await callback(prisma);
      }
      return Promise.all(callback);
    }),
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

describe("Phase 6 Handover Generation, Atomic Receipt & Permission Safeguards", () => {
  const ownerUser = { id: "u-owner", email: "owner@example.com", name: "Alice Owner" };
  const reviewerUser = { id: "u-reviewer", email: "reviewer@example.com", name: "Bob Reviewer" };
  const viewerUser = { id: "u-viewer", email: "viewer@example.com", name: "Charlie Viewer" };

  const makeMembership = (userId: string, role: ProjectRole) =>
    ({
      id: `pm-${role.toLowerCase()}`,
      projectId: "proj-1",
      userId,
      role,
      joinedAt: new Date(),
      project: { id: "proj-1", name: "ContinuityX Core", status: "ACTIVE" },
    }) as never;

  const mockClaim1 = {
    id: "claim-1",
    projectId: "proj-1",
    version: 1,
    attributeKey: "selected_technology",
    valueRaw: "PostgreSQL with Prisma",
    valueNormalized: "POSTGRESQL_PRISMA",
    reviewState: "ACCEPTED",
    subjectEntity: { id: "ent-db", canonicalName: "Database Layer" },
    verifications: [{ id: "v-1", status: "VERIFIED", verifiedAt: new Date() }],
    evidence: [
      {
        id: "ev-1",
        documentId: "doc-1",
        sourceLocation: "Section 2.1",
        excerpt: "We use PostgreSQL managed by Neon with Prisma ORM.",
        document: { id: "doc-1", fileName: "Architecture.pdf", checksum: "hash-doc-1" },
      },
    ],
    reviews: [{ id: "r-1", actions: [{ id: "ra-1", reason: null }] }],
  };

  const mockClaim2 = {
    id: "claim-2",
    projectId: "proj-1",
    version: 1,
    attributeKey: "status",
    valueRaw: "COMPLETED",
    valueNormalized: "COMPLETED",
    reviewState: "ACCEPTED",
    subjectEntity: { id: "ent-auth", canonicalName: "Auth Engine" },
    verifications: [{ id: "v-2", status: "VERIFIED", verifiedAt: new Date() }],
    evidence: [
      {
        id: "ev-2",
        documentId: "doc-1",
        sourceLocation: "Page 4",
        excerpt: "Authentication engine is completed and functional.",
        document: { id: "doc-1", fileName: "Architecture.pdf", checksum: "hash-doc-1" },
      },
    ],
    reviews: [{ id: "r-2", actions: [{ id: "ra-2", reason: null }] }],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.user.findUnique as any).mockImplementation(async ({ where }: any) => {
      if (where.id === ownerUser.id) return ownerUser;
      if (where.id === reviewerUser.id) return reviewerUser;
      if (where.id === viewerUser.id) return viewerUser;
      return null;
    });

    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "proj-1",
      name: "ContinuityX Core",
      status: "ACTIVE",
    } as never);

    vi.mocked(prisma.document.findMany).mockResolvedValue([
      { id: "doc-1", fileName: "Architecture.pdf", checksum: "hash-doc-1" } as never,
    ]);
  });

  it("blocks handover approval in draft preview when no claims are accepted", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(reviewerUser.id, "REVIEWER")
    );
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);
    vi.mocked(prisma.conflict.findMany).mockResolvedValue([]);

    const draft = await getHandoverDraftPreviewService("proj-1", reviewerUser.id);

    expect(draft.canApprove).toBe(false);
    expect(draft.blockingReasons).toContain(
      "Cannot approve handover: No claims have been accepted or edited."
    );
  });

  it("blocks handover approval in draft preview when an accepted claim is in an OPEN conflict", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(reviewerUser.id, "REVIEWER")
    );
    vi.mocked(prisma.claim.findMany).mockResolvedValue([mockClaim1] as never);

    // OPEN conflict involving claim-1
    vi.mocked(prisma.conflict.findMany).mockResolvedValue([
      {
        id: "conflict-1",
        claimAId: "claim-1",
        claimBId: "claim-99",
        status: "OPEN",
        subjectEntity: { id: "ent-db", canonicalName: "Database Layer" },
      } as never,
    ]);

    const draft = await getHandoverDraftPreviewService("proj-1", reviewerUser.id);

    expect(draft.canApprove).toBe(false);
    expect(draft.blockingReasons.some((r) => r.includes("active open conflict"))).toBe(true);
  });

  it("approves handover v1 in one atomic transaction, computing SHA-256 receipt", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(reviewerUser.id, "REVIEWER")
    );
    vi.mocked(prisma.claim.findMany).mockResolvedValue([mockClaim1, mockClaim2] as never);
    vi.mocked(prisma.conflict.findMany).mockResolvedValue([]); // No conflicts
    vi.mocked(prisma.handover.findFirst).mockResolvedValue(null); // No prior handover (Genesis)

    const createdHandover = {
      id: "handover-1",
      projectId: "proj-1",
      version: 1,
      status: "APPROVED",
      title: "ContinuityX Core Handover v1",
      summary: "Approved 2 claims",
      approvedById: reviewerUser.id,
      approvedAt: new Date(),
    };

    vi.mocked(prisma.handover.create).mockResolvedValue(createdHandover as never);
    vi.mocked(prisma.handoverSnapshot.create).mockResolvedValue({
      id: "snapshot-1",
      handoverId: "handover-1",
      schemaVersion: 1,
      canonicalisationVersion: 1,
    } as never);

    vi.mocked(prisma.handoverReceipt.create).mockResolvedValue({
      id: "receipt-1",
      handoverId: "handover-1",
      version: 1,
      snapshotHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      previousReceiptHash: null,
      approvedById: reviewerUser.id,
      approvedAt: new Date(),
      canonicalisationVersion: 1,
      approvedBy: reviewerUser,
    } as never);

    const result = await approveHandoverService("proj-1", reviewerUser.id);

    expect(result.handover).toBeDefined();
    expect(result.handover.version).toBe(1);
    expect(prisma.handover.create).toHaveBeenCalled();
    expect(prisma.handoverSnapshot.create).toHaveBeenCalled();
    expect(prisma.handoverReceipt.create).toHaveBeenCalled();

    // Verify snapshot hash was passed to receipt creation
    const receiptCreateCall = vi.mocked(prisma.handoverReceipt.create).mock.calls[0][0];
    expect(receiptCreateCall.data.previousReceiptHash).toBeNull();
    expect(receiptCreateCall.data.snapshotHash).toHaveLength(64);
  });

  it("links previousReceiptHash chain when creating version 2", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(ownerUser.id, "OWNER")
    );
    vi.mocked(prisma.claim.findMany).mockResolvedValue([mockClaim1] as never);
    vi.mocked(prisma.conflict.findMany).mockResolvedValue([]);

    // Prior version 1 exists with snapshot hash
    const prevHash = "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff";
    vi.mocked(prisma.handover.findFirst).mockResolvedValue({
      id: "handover-1",
      version: 1,
      status: "APPROVED",
      receipt: { snapshotHash: prevHash },
    } as never);

    vi.mocked(prisma.handover.create).mockResolvedValue({ id: "handover-2", version: 2 } as never);
    vi.mocked(prisma.handoverSnapshot.create).mockResolvedValue({ id: "snapshot-2" } as never);
    vi.mocked(prisma.handoverReceipt.create).mockResolvedValue({ id: "receipt-2" } as never);

    await approveHandoverService("proj-1", ownerUser.id);

    const receiptCall = vi.mocked(prisma.handoverReceipt.create).mock.calls[0][0];
    expect(receiptCall.data.version).toBe(2);
    expect(receiptCall.data.previousReceiptHash).toBe(prevHash);
  });

  it("verifies receipt integrity: flags tampering when snapshot is modified", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(viewerUser.id, "VIEWER")
    );

    const validCanonicalJson = JSON.stringify({ test: "unmodified" });
    const correctHash = "fake-correct-hash";

    vi.mocked(prisma.handover.findFirst).mockResolvedValue({
      id: "handover-1",
      projectId: "proj-1",
      version: 1,
      snapshot: {
        canonicalJson: validCanonicalJson,
        schemaVersion: 1,
        canonicalisationVersion: 1,
      },
      receipt: {
        snapshotHash: "different-tampered-hash-value-00000000000000000000000000000000",
        previousReceiptHash: null,
        approvedBy: reviewerUser,
      },
    } as never);

    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);
    vi.mocked(prisma.conflict.findMany).mockResolvedValue([]);

    const report = await verifyHandoverReceiptService("proj-1", "handover-1", viewerUser.id);

    expect(report.valid).toBe(false);
    expect(report.snapshotIntegrity).toBe(false);
    expect(report.explanation).toContain("Tamper alert");
  });

  it("enforces permission matrix: VIEWER cannot approve handover (403 Forbidden)", async () => {
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
      makeMembership(viewerUser.id, "VIEWER")
    );

    await expect(approveHandoverService("proj-1", viewerUser.id)).rejects.toThrow(ForbiddenError);
  });

  it("enforces cross-project boundary: non-member receives 404 Not Found (no resource leakage)", async () => {
    // Non-member (null membership)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(ownerUser as any);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);

    await expect(approveHandoverService("proj-1", "unknown-user")).rejects.toThrow(
      ProjectNotFoundError
    );
  });
});
