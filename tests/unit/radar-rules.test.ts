// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { computeRadarAlertsService } from "@/services/radar";

vi.mock("@/lib/db", () => ({
  prisma: {
    claim: { findMany: vi.fn() },
    entity: { findMany: vi.fn() },
    conflict: { findMany: vi.fn() },
    radarDismissal: { findMany: vi.fn(), upsert: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/permissions", () => ({
  requireProjectAccess: vi.fn().mockResolvedValue({
    user: { id: "u-1", name: "Alice", email: "alice@example.com" },
  }),
}));

describe("Phase 7 Knowledge Loss Radar - Diagnostic Rule Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.radarDismissal.findMany).mockResolvedValue([]);
    vi.mocked(prisma.conflict.findMany).mockResolvedValue([]);
  });

  it("Rule R1: triggers on critical component with 1 owner; does NOT trigger with 2 co-owners", async () => {
    const compEntity = {
      id: "ent-auth",
      canonicalName: "Auth Engine",
      type: "COMPONENT",
      isCritical: true, // Critical by flag
      mergedIntoId: null,
    };

    vi.mocked(prisma.entity.findMany).mockResolvedValue([compEntity] as never);

    // Case A: 1 owner -> Triggers R1
    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      {
        id: "c-1",
        subjectEntityId: "ent-auth",
        attributeKey: "owner",
        valueRaw: "Alice Engineer",
        valueNormalized: "ALICE",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
    ] as never);

    const result1 = await computeRadarAlertsService("proj-1", "u-1");
    const r1Alerts = result1.alerts.filter((a) => a.ruleId === "R1");
    expect(r1Alerts).toHaveLength(1);
    expect(r1Alerts[0].explanation).toContain("Alice Engineer");
    expect(r1Alerts[0].severity).toBe("HIGH");

    // Case B: 2 co-owners -> Does NOT trigger R1 (redundancy satisfied)
    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      {
        id: "c-1",
        subjectEntityId: "ent-auth",
        attributeKey: "owner",
        valueRaw: "Alice Engineer",
        valueNormalized: "ALICE",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
      {
        id: "c-2",
        subjectEntityId: "ent-auth",
        attributeKey: "owner",
        valueRaw: "Bob Engineer",
        valueNormalized: "BOB",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
    ] as never);

    const result2 = await computeRadarAlertsService("proj-1", "u-1");
    expect(result2.alerts.filter((a) => a.ruleId === "R1")).toHaveLength(0);
  });

  it("Rule R2: triggers on critical component with missing architectural documentation", async () => {
    const criticalComp = {
      id: "ent-db",
      canonicalName: "Database Core",
      type: "COMPONENT",
      isCritical: false,
      mergedIntoId: null,
    };

    vi.mocked(prisma.entity.findMany).mockResolvedValue([criticalComp] as never);

    // Give it 3 claims so it qualifies as critical by claim volume, but none are rationale/decision
    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      { id: "c-1", subjectEntityId: "ent-db", attributeKey: "status", valueRaw: "IN_PROGRESS", valueNormalized: "IN_PROGRESS", reviewState: "ACCEPTED", verifications: [], evidence: [] },
      { id: "c-2", subjectEntityId: "ent-db", attributeKey: "owner", valueRaw: "Alice", valueNormalized: "ALICE", reviewState: "ACCEPTED", verifications: [], evidence: [] },
      { id: "c-3", subjectEntityId: "ent-db", attributeKey: "due_date", valueRaw: "2026-12-01", valueNormalized: "2026-12-01", reviewState: "ACCEPTED", verifications: [], evidence: [] },
    ] as never);

    const result = await computeRadarAlertsService("proj-1", "u-1");
    const r2Alerts = result.alerts.filter((a) => a.ruleId === "R2");

    expect(r2Alerts).toHaveLength(1);
    expect(r2Alerts[0].title).toContain("Missing Architectural Documentation");
    expect(r2Alerts[0].missingFieldStatement).toContain("No architectural decision");
  });

  it("Rule R3: triggers on pending task without an owner; does NOT trigger when owner is assigned", async () => {
    const taskEntity = {
      id: "ent-task",
      canonicalName: "Migrate Schema to Neon",
      type: "TASK",
      isCritical: false,
      mergedIntoId: null,
    };

    vi.mocked(prisma.entity.findMany).mockResolvedValue([taskEntity] as never);

    // Case A: Status is IN_PROGRESS, no owner -> triggers R3
    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      {
        id: "c-task-status",
        subjectEntityId: "ent-task",
        attributeKey: "status",
        valueRaw: "In Progress",
        valueNormalized: "IN_PROGRESS",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
    ] as never);

    const res1 = await computeRadarAlertsService("proj-1", "u-1");
    const r3Alerts = res1.alerts.filter((a) => a.ruleId === "R3");
    expect(r3Alerts).toHaveLength(1);
    expect(r3Alerts[0].missingFieldStatement).toContain("No owner claim exists");

    // Case B: Owner claim added -> R3 does not trigger
    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      {
        id: "c-task-status",
        subjectEntityId: "ent-task",
        attributeKey: "status",
        valueRaw: "In Progress",
        valueNormalized: "IN_PROGRESS",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
      {
        id: "c-task-owner",
        subjectEntityId: "ent-task",
        attributeKey: "owner",
        valueRaw: "Charlie",
        valueNormalized: "CHARLIE",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
    ] as never);

    const res2 = await computeRadarAlertsService("proj-1", "u-1");
    expect(res2.alerts.filter((a) => a.ruleId === "R3")).toHaveLength(0);
  });

  it("Rule R4: triggers on selected_technology without rationale; does NOT trigger with rationale", async () => {
    const techEntity = {
      id: "ent-cache",
      canonicalName: "Cache Layer",
      type: "COMPONENT",
      isCritical: false,
      mergedIntoId: null,
    };

    vi.mocked(prisma.entity.findMany).mockResolvedValue([techEntity] as never);

    // Case A: selected_technology without rationale
    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      {
        id: "c-tech",
        subjectEntityId: "ent-cache",
        attributeKey: "selected_technology",
        valueRaw: "Redis v7",
        valueNormalized: "REDIS",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
    ] as never);

    const res1 = await computeRadarAlertsService("proj-1", "u-1");
    const r4Alerts = res1.alerts.filter((a) => a.ruleId === "R4");
    expect(r4Alerts).toHaveLength(1);
    expect(r4Alerts[0].title).toContain("Undocumented Technology Rationale");

    // Case B: rationale claim added
    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      {
        id: "c-tech",
        subjectEntityId: "ent-cache",
        attributeKey: "selected_technology",
        valueRaw: "Redis v7",
        valueNormalized: "REDIS",
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
      {
        id: "c-rationale",
        subjectEntityId: "ent-cache",
        attributeKey: "rationale",
        valueRaw: "Redis chosen for low latency sub-millisecond session caching.",
        valueNormalized: null,
        reviewState: "ACCEPTED",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
    ] as never);

    const res2 = await computeRadarAlertsService("proj-1", "u-1");
    expect(res2.alerts.filter((a) => a.ruleId === "R4")).toHaveLength(0);
  });

  it("Rule R5: triggers on active open_question claims", async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.claim.findMany).mockResolvedValue([
      {
        id: "c-question",
        subjectEntityId: "ent-auth",
        subjectEntity: { id: "ent-auth", canonicalName: "Auth Engine", type: "COMPONENT" },
        attributeKey: "open_question",
        valueRaw: "Should we support WebAuthn passkeys in v1 or v2?",
        valueNormalized: null,
        reviewState: "PENDING",
        verifications: [{ status: "VERIFIED" }],
        evidence: [],
      },
    ] as never);

    const res = await computeRadarAlertsService("proj-1", "u-1");
    const r5Alerts = res.alerts.filter((a) => a.ruleId === "R5");
    expect(r5Alerts).toHaveLength(1);
    expect(r5Alerts[0].explanation).toContain("WebAuthn passkeys");
    expect(r5Alerts[0].severity).toBe("LOW");
  });

  it("Rule R6: triggers on components or tasks in an active OPEN conflict", async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);

    vi.mocked(prisma.conflict.findMany).mockResolvedValue([
      {
        id: "conf-1",
        subjectEntityId: "ent-backend",
        attributeKey: "status",
        status: "OPEN",
        subjectEntity: { id: "ent-backend", canonicalName: "Backend Architecture", type: "COMPONENT" },
        claimA: {
          id: "claim-a",
          attributeKey: "status",
          valueRaw: "COMPLETED",
          valueNormalized: "COMPLETED",
          reviewState: "ACCEPTED",
          verifications: [{ status: "VERIFIED" }],
          evidence: [],
        },
        claimB: {
          id: "claim-b",
          attributeKey: "status",
          valueRaw: "IN_PROGRESS",
          valueNormalized: "IN_PROGRESS",
          reviewState: "PENDING",
          verifications: [{ status: "WEAK_SUPPORT" }],
          evidence: [],
        },
      },
    ] as never);

    const res = await computeRadarAlertsService("proj-1", "u-1");
    const r6Alerts = res.alerts.filter((a) => a.ruleId === "R6");
    expect(r6Alerts).toHaveLength(1);
    expect(r6Alerts[0].severity).toBe("HIGH");
    expect(r6Alerts[0].explanation).toContain("COMPLETED");
    expect(r6Alerts[0].explanation).toContain("IN_PROGRESS");
  });

  it("Edge cases: empty project produces 0 alerts and all metrics zero", async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);
    vi.mocked(prisma.conflict.findMany).mockResolvedValue([]);

    const res = await computeRadarAlertsService("proj-1", "u-1");
    expect(res.alerts).toHaveLength(0);
    expect(res.metrics.totalOpen).toBe(0);
    expect(res.metrics.bySeverity.HIGH).toBe(0);
    expect(res.metrics.bySeverity.MEDIUM).toBe(0);
    expect(res.metrics.bySeverity.LOW).toBe(0);
  });
});
