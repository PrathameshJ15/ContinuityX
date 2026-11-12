// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { computeContinuityIntelligenceService } from "@/services/intelligence/score";

vi.mock("@/lib/db", () => ({
  prisma: {
    entity: { findMany: vi.fn() },
    claim: { findMany: vi.fn() },
    conflict: { findMany: vi.fn() },
    projectMember: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/permissions", () => ({
  requireProjectAccess: vi.fn().mockResolvedValue({
    user: { id: "u-1", name: "Alice", email: "alice@example.com" },
  }),
}));

describe("Phase 8 Continuity Score Heuristics & Coverage Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.conflict.findMany).mockResolvedValue([]);
  });

  it("handles missing metrics correctly: excludes them from denominator rather than treating as zero", async () => {
    // Only 1 critical component exists with verified evidence (Metric 1 weight: 25 -> 100%)
    // Only 1 pending task exists with an assigned owner (Metric 3 weight: 20 -> 100%)
    // Only 1 claim exists and is accepted (Metric 5 weight: 20 -> 100%)
    // Metric 2 (selected_technology, weight 20) and Metric 4 (depends_on, weight 15) have NO data (denominators 0)
    // Available weight = 25 + 20 + 20 = 65% (>= 60%)
    // Expected score = (25*100 + 20*100 + 20*100) / 65 = 100.
    // IF missing metrics were treated as 0: (25*100 + 20*0 + 20*100 + 15*0 + 20*100) / 100 = 65 (False drag!)

    const compEntity = {
      id: "ent-auth",
      canonicalName: "Auth Engine",
      type: "COMPONENT",
      isCritical: true,
      mergedIntoId: null,
    };

    const taskEntity = {
      id: "ent-task",
      canonicalName: "Deploy to Production",
      type: "TASK",
      isCritical: false,
      mergedIntoId: null,
    };

    vi.mocked(prisma.entity.findMany).mockResolvedValue([compEntity, taskEntity] as never);

    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      {
        id: "c-1",
        subjectEntityId: "ent-auth",
        attributeKey: "status",
        valueRaw: "COMPLETED",
        valueNormalized: "COMPLETED",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [{ id: "ev-1", excerpt: "Done" }],
      },
      {
        id: "c-2",
        subjectEntityId: "ent-task",
        attributeKey: "status",
        valueRaw: "IN_PROGRESS",
        valueNormalized: "IN_PROGRESS",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
      {
        id: "c-3",
        subjectEntityId: "ent-task",
        attributeKey: "owner",
        valueRaw: "Alice",
        valueNormalized: "ALICE",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
    ] as never);

    const result = await computeContinuityIntelligenceService("proj-1", "u-1");
    const score = result.score;

    expect(score.hasSufficientEvidence).toBe(true);
    expect(score.availableCoveragePercentage).toBe(65);
    expect(score.score).toBe(100); // Proves missing metrics were NOT dragged down to 0!
  });

  it("below 60% coverage displays Insufficient Evidence instead of a score", async () => {
    // Only Metric 1 has evidence (weight 25 < 60%)
    const compEntity = {
      id: "ent-auth",
      canonicalName: "Auth Engine",
      type: "COMPONENT",
      isCritical: true,
      mergedIntoId: null,
    };

    vi.mocked(prisma.entity.findMany).mockResolvedValue([compEntity] as never);
    vi.mocked(prisma.claim.findMany).mockResolvedValue([] as never);

    const result = await computeContinuityIntelligenceService("proj-1", "u-1");
    const score = result.score;

    expect(score.hasSufficientEvidence).toBe(false);
    expect(score.score).toBeNull();
    expect(score.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(score.explanation).toContain("Insufficient evidence");
  });

  it("exactly 60% coverage calculates and displays a score", async () => {
    // We construct exactly 60% available weight:
    // Metric 2 (Decision Traceability, weight 20)
    // Metric 3 (Ownership Coverage, weight 20)
    // Metric 5 (Handover Readiness, weight 20)
    // Total available = 20 + 20 + 20 = 60%.
    const compEntity = {
      id: "ent-tech",
      canonicalName: "Database Layer",
      type: "COMPONENT",
      isCritical: false, // Not critical -> Metric 1 has denominator 0
      mergedIntoId: null,
    };

    const taskEntity = {
      id: "ent-task",
      canonicalName: "Run Migration",
      type: "TASK",
      isCritical: false,
      mergedIntoId: null,
    };

    vi.mocked(prisma.entity.findMany).mockResolvedValue([compEntity, taskEntity] as never);

    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      {
        id: "c-tech",
        subjectEntityId: "ent-tech",
        attributeKey: "selected_technology",
        valueRaw: "Postgres",
        valueNormalized: "POSTGRES",
        reviewState: "ACCEPTED",
        verifications: [],
        evidence: [],
      },
      {
        id: "c-rat",
        subjectEntityId: "ent-tech",
        attributeKey: "rationale",
        valueRaw: "ACID compliance",
        valueNormalized: null,
        reviewState: "ACCEPTED",
        verifications: [],
        evidence: [],
      },
      {
        id: "c-task-status",
        subjectEntityId: "ent-task",
        attributeKey: "status",
        valueRaw: "IN_PROGRESS",
        valueNormalized: "IN_PROGRESS",
        reviewState: "ACCEPTED",
        verifications: [],
        evidence: [],
      },
      {
        id: "c-task-owner",
        subjectEntityId: "ent-task",
        attributeKey: "owner",
        valueRaw: "Bob",
        valueNormalized: "BOB",
        reviewState: "ACCEPTED",
        verifications: [],
        evidence: [],
      },
    ] as never);

    const result = await computeContinuityIntelligenceService("proj-1", "u-1");
    const score = result.score;

    expect(score.availableCoveragePercentage).toBe(60);
    expect(score.hasSufficientEvidence).toBe(true);
    expect(score.score).not.toBeNull();
  });

  it("Bus Factor Map: flags single-owner critical component and does not flag multi-owner component", async () => {
    const singleOwnerComp = {
      id: "ent-c1",
      canonicalName: "Payment Gateway",
      type: "COMPONENT",
      isCritical: true,
      mergedIntoId: null,
    };

    const multiOwnerComp = {
      id: "ent-c2",
      canonicalName: "Frontend Shell",
      type: "COMPONENT",
      isCritical: true,
      mergedIntoId: null,
    };

    vi.mocked(prisma.entity.findMany).mockResolvedValue([singleOwnerComp, multiOwnerComp] as never);

    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      {
        id: "c-1",
        subjectEntityId: "ent-c1",
        attributeKey: "owner",
        valueRaw: "Alice",
        valueNormalized: "ALICE",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
      {
        id: "c-2",
        subjectEntityId: "ent-c2",
        attributeKey: "owner",
        valueRaw: "Bob",
        valueNormalized: "BOB",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
      {
        id: "c-3",
        subjectEntityId: "ent-c2",
        attributeKey: "owner",
        valueRaw: "Charlie",
        valueNormalized: "CHARLIE",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
    ] as never);

    const result = await computeContinuityIntelligenceService("proj-1", "u-1");
    const bus = result.busFactor;

    const c1 = bus.components.find((c) => c.componentId === "ent-c1");
    const c2 = bus.components.find((c) => c.componentId === "ent-c2");

    expect(c1?.isSingleOwner).toBe(true);
    expect(c1?.busFactor).toBe(1);

    expect(c2?.isSingleOwner).toBe(false);
    expect(c2?.busFactor).toBe(2);

    expect(bus.singleOwnerCount).toBe(1);
  });
});
