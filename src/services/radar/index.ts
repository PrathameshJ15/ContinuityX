import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/permissions";
import { BadRequestError, NotFoundError } from "@/lib/api-response";
import { writeAudit } from "@/lib/audit";

export type RadarRuleId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

export type RadarCategory =
  | "SINGLE_POINT_OF_FAILURE"
  | "DOCUMENTATION_GAP"
  | "UNASSIGNED_WORK"
  | "MISSING_RATIONALE"
  | "OPEN_QUESTION"
  | "DATA_INCONSISTENCY";

export type RadarSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface RadarAlert {
  id: string; // Deterministic alert key e.g. "R1:ent-auth"
  ruleId: RadarRuleId;
  category: RadarCategory;
  title: string;
  explanation: string;
  severity: RadarSeverity;
  affectedEntity?: {
    id: string;
    canonicalName: string;
    type: string;
    isCritical?: boolean;
  };
  affectedClaims: Array<{
    id: string;
    attributeKey: string;
    valueRaw: string;
    valueNormalized: string | null;
    evidenceStatus: string;
    reviewState: string;
  }>;
  evidenceLinks: Array<{
    documentId: string;
    fileName: string;
    location: string;
    excerpt: string;
  }>;
  missingFieldStatement?: string;
  suggestedRemediation: string;
  status: "OPEN" | "DISMISSED";
  dismissedReason?: string;
  dismissedAt?: string;
  dismissedBy?: { id: string; name: string };
}

export interface RadarMetrics {
  totalOpen: number;
  totalDismissed: number;
  bySeverity: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  byRule: Record<RadarRuleId, number>;
}

/**
 * Pure, deterministic project-scoped Radar Service.
 * Evaluates the 6 knowledge loss rules defined in PLAN_AND_TESTING.md.
 * Reads non-rejected claims only and derives explainable risk indicators.
 */
export async function computeRadarAlertsService(
  projectId: string,
  userId: string,
  filters?: { ruleId?: string; status?: "OPEN" | "DISMISSED" | "ALL" }
): Promise<{ alerts: RadarAlert[]; metrics: RadarMetrics }> {
  await requireProjectAccess(projectId, "project:read", userId);

  // 1. Fetch non-rejected claims with relations
  const claims = await prisma.claim.findMany({
    where: {
      projectId,
      reviewState: { not: "REJECTED" },
    },
    include: {
      subjectEntity: true,
      verifications: {
        orderBy: { verifiedAt: "desc" },
        take: 1,
      },
      evidence: {
        include: {
          document: {
            select: { id: true, fileName: true, checksum: true },
          },
        },
      },
    },
  });

  // 2. Fetch all entities for project (excluding merged duplicates)
  const entities = await prisma.entity.findMany({
    where: {
      projectId,
      mergedIntoId: null, // Merged entities are counted once under their canonical target
    },
  });

  // 3. Fetch active conflicts
  const conflicts = await prisma.conflict.findMany({
    where: {
      projectId,
      status: { in: ["OPEN", "POSSIBLY_SUPERSEDED", "UNDER_REVIEW", "REQUIRES_CLARIFICATION"] },
    },
    include: {
      subjectEntity: true,
      claimA: {
        include: {
          verifications: { orderBy: { verifiedAt: "desc" }, take: 1 },
          evidence: { include: { document: true } },
        },
      },
      claimB: {
        include: {
          verifications: { orderBy: { verifiedAt: "desc" }, take: 1 },
          evidence: { include: { document: true } },
        },
      },
    },
  });

  // 4. Fetch stored dismissals
  const dismissals = await prisma.radarDismissal.findMany({
    where: { projectId },
    include: {
      dismissedBy: { select: { id: true, name: true, email: true } },
    },
  });
  const dismissalMap = new Map(dismissals.map((d) => [d.alertKey, d]));

  // Index claims by subject entity ID
  const claimsByEntity = new Map<string, typeof claims>();
  for (const c of claims) {
    const list = claimsByEntity.get(c.subjectEntityId) || [];
    list.push(c);
    claimsByEntity.set(c.subjectEntityId, list);
  }

  // Index inbound dependencies: entities targeted by `depends_on`
  const inboundDependencyNames = new Set<string>();
  for (const c of claims) {
    if (c.attributeKey === "depends_on") {
      if (c.valueNormalized) inboundDependencyNames.add(c.valueNormalized.toLowerCase());
      if (c.valueRaw) inboundDependencyNames.add(c.valueRaw.toLowerCase());
    }
  }

  // Identify Critical Components
  // Definition from PLAN_AND_TESTING.md:
  // Component: Entity of type COMPONENT
  // Critical component: >= 3 claims, OR target of depends_on claim, OR marked isCritical
  const criticalComponents = entities.filter((ent) => {
    if (ent.type !== "COMPONENT") return false;
    if (ent.isCritical) return true;
    const entClaims = claimsByEntity.get(ent.id) || [];
    if (entClaims.length >= 3) return true;
    if (inboundDependencyNames.has(ent.canonicalName.toLowerCase())) return true;
    return false;
  });

  const alerts: RadarAlert[] = [];

  // -------------------------------------------------------------
  // RULE R1: Single-Person Dependency (Bus Factor = 1)
  // Critical component with exactly one distinct owner claim
  // -------------------------------------------------------------
  for (const comp of criticalComponents) {
    const compClaims = claimsByEntity.get(comp.id) || [];
    const ownerClaims = compClaims.filter((c) => c.attributeKey === "owner");

    // Get unique owner values
    const distinctOwners = Array.from(
      new Set(ownerClaims.map((c) => c.valueNormalized || c.valueRaw))
    );

    if (distinctOwners.length === 1) {
      const singleOwnerName = ownerClaims[0]?.valueRaw || distinctOwners[0];
      const alertKey = `R1:${comp.id}`;
      const dismissal = dismissalMap.get(alertKey);

      alerts.push({
        id: alertKey,
        ruleId: "R1",
        category: "SINGLE_POINT_OF_FAILURE",
        title: `Single-Person Dependency: ${comp.canonicalName}`,
        explanation: `Critical component '${comp.canonicalName}' has a single verified owner ('${singleOwnerName}'). If this team member is unavailable, architecture knowledge is at high risk.`,
        severity: "HIGH",
        affectedEntity: {
          id: comp.id,
          canonicalName: comp.canonicalName,
          type: comp.type,
          isCritical: true,
        },
        affectedClaims: ownerClaims.map((c) => ({
          id: c.id,
          attributeKey: c.attributeKey,
          valueRaw: c.valueRaw,
          valueNormalized: c.valueNormalized,
          evidenceStatus: c.verifications[0]?.status || "UNVERIFIED",
          reviewState: c.reviewState,
        })),
        evidenceLinks: ownerClaims.flatMap((c) =>
          c.evidence.map((ev) => ({
            documentId: ev.documentId,
            fileName: ev.document?.fileName || "Document",
            location: ev.sourceLocation,
            excerpt: ev.excerpt,
          }))
        ),
        suggestedRemediation: `Cross-train a secondary engineer on '${comp.canonicalName}' and add a verified co-owner claim to eliminate the single point of failure.`,
        status: dismissal ? "DISMISSED" : "OPEN",
        dismissedReason: dismissal?.reason,
        dismissedAt: dismissal?.dismissedAt.toISOString(),
        dismissedBy: dismissal ? { id: dismissal.dismissedBy.id, name: dismissal.dismissedBy.name } : undefined,
      });
    }
  }

  // -------------------------------------------------------------
  // RULE R2: Missing Documentation
  // Critical component with no decision or rationale claim and no document mentioning it
  // -------------------------------------------------------------
  for (const comp of criticalComponents) {
    const compClaims = claimsByEntity.get(comp.id) || [];
    const hasDecisionOrRationale = compClaims.some(
      (c) =>
        c.attributeKey === "selected_technology" ||
        c.attributeKey === "decision" ||
        c.attributeKey === "rationale"
    );

    const hasDocumentEvidence = compClaims.some((c) => c.evidence.length > 0);

    if (!hasDecisionOrRationale || !hasDocumentEvidence) {
      const alertKey = `R2:${comp.id}`;
      const dismissal = dismissalMap.get(alertKey);

      alerts.push({
        id: alertKey,
        ruleId: "R2",
        category: "DOCUMENTATION_GAP",
        title: `Missing Architectural Documentation: ${comp.canonicalName}`,
        explanation: `Critical component '${comp.canonicalName}' has no recorded architectural decision or technical rationale claims.`,
        severity: "HIGH",
        affectedEntity: {
          id: comp.id,
          canonicalName: comp.canonicalName,
          type: comp.type,
          isCritical: true,
        },
        affectedClaims: compClaims.slice(0, 3).map((c) => ({
          id: c.id,
          attributeKey: c.attributeKey,
          valueRaw: c.valueRaw,
          valueNormalized: c.valueNormalized,
          evidenceStatus: c.verifications[0]?.status || "UNVERIFIED",
          reviewState: c.reviewState,
        })),
        evidenceLinks: [],
        missingFieldStatement: `No architectural decision, technology selection, or rationale claims exist for critical component '${comp.canonicalName}'.`,
        suggestedRemediation: `Upload design documentation or record technical rationale explaining the implementation choices for '${comp.canonicalName}'.`,
        status: dismissal ? "DISMISSED" : "OPEN",
        dismissedReason: dismissal?.reason,
        dismissedAt: dismissal?.dismissedAt.toISOString(),
        dismissedBy: dismissal ? { id: dismissal.dismissedBy.id, name: dismissal.dismissedBy.name } : undefined,
      });
    }
  }

  // -------------------------------------------------------------
  // RULE R3: Unassigned Work Item
  // Task claim with status in NOT_STARTED/IN_PROGRESS/BLOCKED and no owner claim
  // -------------------------------------------------------------
  for (const ent of entities) {
    const entClaims = claimsByEntity.get(ent.id) || [];
    const statusClaim = entClaims.find(
      (c) =>
        c.attributeKey === "status" &&
        c.valueNormalized &&
        ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"].includes(c.valueNormalized)
    );

    const hasOwnerClaim = entClaims.some((c) => c.attributeKey === "owner");

    if (statusClaim && !hasOwnerClaim) {
      const alertKey = `R3:${ent.id}`;
      const dismissal = dismissalMap.get(alertKey);

      alerts.push({
        id: alertKey,
        ruleId: "R3",
        category: "UNASSIGNED_WORK",
        title: `Unassigned Pending Task: ${ent.canonicalName}`,
        explanation: `Task '${ent.canonicalName}' is currently marked '${statusClaim.valueRaw}' but has no designated owner claim.`,
        severity: "MEDIUM",
        affectedEntity: {
          id: ent.id,
          canonicalName: ent.canonicalName,
          type: ent.type,
        },
        affectedClaims: [
          {
            id: statusClaim.id,
            attributeKey: statusClaim.attributeKey,
            valueRaw: statusClaim.valueRaw,
            valueNormalized: statusClaim.valueNormalized,
            evidenceStatus: statusClaim.verifications[0]?.status || "UNVERIFIED",
            reviewState: statusClaim.reviewState,
          },
        ],
        evidenceLinks: statusClaim.evidence.map((ev) => ({
          documentId: ev.documentId,
          fileName: ev.document?.fileName || "Document",
          location: ev.sourceLocation,
          excerpt: ev.excerpt,
        })),
        missingFieldStatement: `No owner claim exists for task '${ent.canonicalName}'.`,
        suggestedRemediation: `Assign an accountable owner or reviewer to this pending task in the Review Queue.`,
        status: dismissal ? "DISMISSED" : "OPEN",
        dismissedReason: dismissal?.reason,
        dismissedAt: dismissal?.dismissedAt.toISOString(),
        dismissedBy: dismissal ? { id: dismissal.dismissedBy.id, name: dismissal.dismissedBy.name } : undefined,
      });
    }
  }

  // -------------------------------------------------------------
  // RULE R4: Missing Technical Rationale
  // selected_technology claim with no rationale claim for the same subject
  // -------------------------------------------------------------
  for (const ent of entities) {
    const entClaims = claimsByEntity.get(ent.id) || [];
    const techClaims = entClaims.filter((c) => c.attributeKey === "selected_technology");
    const hasRationaleClaim = entClaims.some((c) => c.attributeKey === "rationale");

    for (const techClaim of techClaims) {
      if (!hasRationaleClaim) {
        const alertKey = `R4:${techClaim.id}`;
        const dismissal = dismissalMap.get(alertKey);

        alerts.push({
          id: alertKey,
          ruleId: "R4",
          category: "MISSING_RATIONALE",
          title: `Undocumented Technology Rationale: ${ent.canonicalName}`,
          explanation: `Technology choice '${techClaim.valueRaw}' for '${ent.canonicalName}' has no documented rationale or trade-off evaluation recorded.`,
          severity: "MEDIUM",
          affectedEntity: {
            id: ent.id,
            canonicalName: ent.canonicalName,
            type: ent.type,
          },
          affectedClaims: [
            {
              id: techClaim.id,
              attributeKey: techClaim.attributeKey,
              valueRaw: techClaim.valueRaw,
              valueNormalized: techClaim.valueNormalized,
              evidenceStatus: techClaim.verifications[0]?.status || "UNVERIFIED",
              reviewState: techClaim.reviewState,
            },
          ],
          evidenceLinks: techClaim.evidence.map((ev) => ({
            documentId: ev.documentId,
            fileName: ev.document?.fileName || "Document",
            location: ev.sourceLocation,
            excerpt: ev.excerpt,
          })),
          missingFieldStatement: `No rationale claim exists justifying the selection of '${techClaim.valueRaw}'.`,
          suggestedRemediation: `Add a rationale claim detailing why '${techClaim.valueRaw}' was selected over alternatives.`,
          status: dismissal ? "DISMISSED" : "OPEN",
          dismissedReason: dismissal?.reason,
          dismissedAt: dismissal?.dismissedAt.toISOString(),
          dismissedBy: dismissal ? { id: dismissal.dismissedBy.id, name: dismissal.dismissedBy.name } : undefined,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // RULE R5: Unresolved Question
  // open_question claim not marked resolved
  // -------------------------------------------------------------
  for (const c of claims) {
    if (c.attributeKey === "open_question") {
      const alertKey = `R5:${c.id}`;
      const dismissal = dismissalMap.get(alertKey);

      alerts.push({
        id: alertKey,
        ruleId: "R5",
        category: "OPEN_QUESTION",
        title: `Unresolved Question: ${c.subjectEntity.canonicalName}`,
        explanation: `Open project question: "${c.valueRaw}" regarding '${c.subjectEntity.canonicalName}' has not been resolved.`,
        severity: "LOW",
        affectedEntity: {
          id: c.subjectEntity.id,
          canonicalName: c.subjectEntity.canonicalName,
          type: c.subjectEntity.type,
        },
        affectedClaims: [
          {
            id: c.id,
            attributeKey: c.attributeKey,
            valueRaw: c.valueRaw,
            valueNormalized: c.valueNormalized,
            evidenceStatus: c.verifications[0]?.status || "UNVERIFIED",
            reviewState: c.reviewState,
          },
        ],
        evidenceLinks: c.evidence.map((ev) => ({
          documentId: ev.documentId,
          fileName: ev.document?.fileName || "Document",
          location: ev.sourceLocation,
          excerpt: ev.excerpt,
        })),
        suggestedRemediation: `Consult stakeholders to resolve this open inquiry, update project documentation, or reject this claim if obsolete.`,
        status: dismissal ? "DISMISSED" : "OPEN",
        dismissedReason: dismissal?.reason,
        dismissedAt: dismissal?.dismissedAt.toISOString(),
        dismissedBy: dismissal ? { id: dismissal.dismissedBy.id, name: dismissal.dismissedBy.name } : undefined,
      });
    }
  }

  // -------------------------------------------------------------
  // RULE R6: Architectural / State Inconsistency
  // Component or task participating in an active OPEN conflict
  // -------------------------------------------------------------
  for (const conflict of conflicts) {
    const alertKey = `R6:${conflict.id}`;
    const dismissal = dismissalMap.get(alertKey);

    const claimA = conflict.claimA;
    const claimB = conflict.claimB;

    alerts.push({
      id: alertKey,
      ruleId: "R6",
      category: "DATA_INCONSISTENCY",
      title: `Unresolved Conflict: ${conflict.subjectEntity.canonicalName}`,
      explanation: `Competing assertions detected for '${conflict.subjectEntity.canonicalName} -> ${conflict.attributeKey}'. Claim A asserts '${claimA.valueRaw}' while Claim B asserts '${claimB.valueRaw}'.`,
      severity: "HIGH",
      affectedEntity: {
        id: conflict.subjectEntity.id,
        canonicalName: conflict.subjectEntity.canonicalName,
        type: conflict.subjectEntity.type,
      },
      affectedClaims: [
        {
          id: claimA.id,
          attributeKey: claimA.attributeKey,
          valueRaw: claimA.valueRaw,
          valueNormalized: claimA.valueNormalized,
          evidenceStatus: claimA.verifications[0]?.status || "UNVERIFIED",
          reviewState: claimA.reviewState,
        },
        {
          id: claimB.id,
          attributeKey: claimB.attributeKey,
          valueRaw: claimB.valueRaw,
          valueNormalized: claimB.valueNormalized,
          evidenceStatus: claimB.verifications[0]?.status || "UNVERIFIED",
          reviewState: claimB.reviewState,
        },
      ],
      evidenceLinks: [
        ...claimA.evidence.map((ev) => ({
          documentId: ev.documentId,
          fileName: ev.document?.fileName || "Document",
          location: ev.sourceLocation,
          excerpt: ev.excerpt,
        })),
        ...claimB.evidence.map((ev) => ({
          documentId: ev.documentId,
          fileName: ev.document?.fileName || "Document",
          location: ev.sourceLocation,
          excerpt: ev.excerpt,
        })),
      ],
      suggestedRemediation: `Navigate to Conflicts view and resolve the discrepancy (CHOOSE_A, CHOOSE_B, KEEP_BOTH for co-owners, or CONFIRM_SUPERSEDED).`,
      status: dismissal ? "DISMISSED" : "OPEN",
      dismissedReason: dismissal?.reason,
      dismissedAt: dismissal?.dismissedAt.toISOString(),
      dismissedBy: dismissal ? { id: dismissal.dismissedBy.id, name: dismissal.dismissedBy.name } : undefined,
    });
  }

  // Calculate Metrics
  const openAlerts = alerts.filter((a) => a.status === "OPEN");
  const dismissedAlerts = alerts.filter((a) => a.status === "DISMISSED");

  const byRule: Record<RadarRuleId, number> = {
    R1: openAlerts.filter((a) => a.ruleId === "R1").length,
    R2: openAlerts.filter((a) => a.ruleId === "R2").length,
    R3: openAlerts.filter((a) => a.ruleId === "R3").length,
    R4: openAlerts.filter((a) => a.ruleId === "R4").length,
    R5: openAlerts.filter((a) => a.ruleId === "R5").length,
    R6: openAlerts.filter((a) => a.ruleId === "R6").length,
  };

  const bySeverity = {
    HIGH: openAlerts.filter((a) => a.severity === "HIGH").length,
    MEDIUM: openAlerts.filter((a) => a.severity === "MEDIUM").length,
    LOW: openAlerts.filter((a) => a.severity === "LOW").length,
  };

  const metrics: RadarMetrics = {
    totalOpen: openAlerts.length,
    totalDismissed: dismissedAlerts.length,
    bySeverity,
    byRule,
  };

  // Apply filters
  let filteredAlerts = alerts;
  if (filters?.ruleId && filters.ruleId !== "ALL") {
    filteredAlerts = filteredAlerts.filter((a) => a.ruleId === filters.ruleId);
  }
  if (filters?.status === "OPEN") {
    filteredAlerts = filteredAlerts.filter((a) => a.status === "OPEN");
  } else if (filters?.status === "DISMISSED") {
    filteredAlerts = filteredAlerts.filter((a) => a.status === "DISMISSED");
  }

  return { alerts: filteredAlerts, metrics };
}

/**
 * Dismisses a Radar alert with a mandatory written justification (audited)
 */
export async function dismissRadarAlertService(
  projectId: string,
  alertKey: string,
  ruleId: string,
  reason: string,
  userId: string
) {
  await requireProjectAccess(projectId, "review:claims_conflicts_entities", userId);

  if (!reason || !reason.trim()) {
    throw new BadRequestError("A written justification reason is mandatory to dismiss a Knowledge Loss alert.");
  }

  const dismissal = await prisma.radarDismissal.upsert({
    where: {
      projectId_alertKey: { projectId, alertKey },
    },
    create: {
      projectId,
      alertKey,
      ruleId,
      reason: reason.trim(),
      dismissedById: userId,
    },
    update: {
      reason: reason.trim(),
      dismissedById: userId,
      dismissedAt: new Date(),
    },
  });

  await writeAudit({
    projectId,
    userId,
    action: "RADAR_ALERT_DISMISSED",
    entityType: "RADAR_ALERT",
    entityId: alertKey,
    metadata: { ruleId, reason: reason.trim() },
  });

  return dismissal;
}

/**
 * Reactivates a previously dismissed alert
 */
export async function reactivateRadarAlertService(projectId: string, alertKey: string, userId: string) {
  await requireProjectAccess(projectId, "review:claims_conflicts_entities", userId);

  const existing = await prisma.radarDismissal.findUnique({
    where: {
      projectId_alertKey: { projectId, alertKey },
    },
  });

  if (!existing) {
    throw new NotFoundError("Dismissal record not found for this alert.");
  }

  await prisma.radarDismissal.delete({
    where: {
      projectId_alertKey: { projectId, alertKey },
    },
  });

  await writeAudit({
    projectId,
    userId,
    action: "RADAR_ALERT_REACTIVATED",
    entityType: "RADAR_ALERT",
    entityId: alertKey,
    metadata: { ruleId: existing.ruleId },
  });

  return { success: true, alertKey };
}
