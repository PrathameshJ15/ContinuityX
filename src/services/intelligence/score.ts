import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/permissions";

export interface MetricBreakdown {
  name: string;
  weight: number;
  score: number; // 0 to 100
  numerator: number;
  denominator: number;
  hasSufficientEvidence: boolean;
  explanation: string;
  formula: string;
}

export interface ContinuityScoreResult {
  score: number | null; // null if insufficient coverage (< 60%)
  hasSufficientEvidence: boolean;
  availableCoveragePercentage: number; // Total weight of available metrics (0 to 100)
  status: "GOOD" | "MODERATE" | "NEEDS_ATTENTION" | "INSUFFICIENT_EVIDENCE";
  explanation: string;
  metrics: MetricBreakdown[];
  disclaimer: string;
}

export interface BusFactorItem {
  componentId: string;
  componentName: string;
  isCritical: boolean;
  owners: Array<{ name: string; claimId: string; evidenceStatus: string }>;
  busFactor: number;
  isSingleOwner: boolean;
}

export interface BusFactorMapResult {
  components: BusFactorItem[];
  totalComponents: number;
  singleOwnerCount: number;
  disclaimer: string;
}

/**
 * Computes the explainable Continuity Score and Bus Factor Map.
 * SPEC.md & PLAN_AND_TESTING.md:
 * - Weights: Documentation (25), Decision Traceability (20), Ownership (20), Dependency Clarity (15), Handover Readiness (20).
 * - Missing metrics (denominator 0) are excluded from numerator AND denominator (NOT treated as zero).
 * - Minimum 60% available coverage required to present a score.
 */
export async function computeContinuityIntelligenceService(
  projectId: string,
  userId: string
): Promise<{ score: ContinuityScoreResult; busFactor: BusFactorMapResult }> {
  await requireProjectAccess(projectId, "project:read", userId);

  // 1. Fetch project entities (excluding merged)
  const entities = await prisma.entity.findMany({
    where: { projectId, mergedIntoId: null },
  });

  // 2. Fetch non-rejected claims
  const claims = await prisma.claim.findMany({
    where: { projectId, reviewState: { not: "REJECTED" } },
    include: {
      subjectEntity: true,
      verifications: { orderBy: { verifiedAt: "desc" }, take: 1 },
      evidence: true,
    },
  });

  // 3. Fetch active conflicts
  const openConflicts = await prisma.conflict.findMany({
    where: {
      projectId,
      status: { in: ["OPEN", "POSSIBLY_SUPERSEDED", "UNDER_REVIEW", "REQUIRES_CLARIFICATION"] },
    },
  });

  // Map claims by subject entity ID
  const claimsByEntity = new Map<string, typeof claims>();
  for (const c of claims) {
    const list = claimsByEntity.get(c.subjectEntityId) || [];
    list.push(c);
    claimsByEntity.set(c.subjectEntityId, list);
  }

  // Inbound dependency targets
  const inboundDependencies = new Set<string>();
  for (const c of claims) {
    if (c.attributeKey === "depends_on") {
      if (c.valueNormalized) inboundDependencies.add(c.valueNormalized.toLowerCase());
      if (c.valueRaw) inboundDependencies.add(c.valueRaw.toLowerCase());
    }
  }

  // Critical Components: COMPONENT type with >= 3 claims, or inbound depends_on, or isCritical
  const components = entities.filter((e) => e.type === "COMPONENT");
  const criticalComponents = components.filter((comp) => {
    if (comp.isCritical) return true;
    const cList = claimsByEntity.get(comp.id) || [];
    if (cList.length >= 3) return true;
    if (inboundDependencies.has(comp.canonicalName.toLowerCase())) return true;
    return false;
  });

  // -----------------------------------------------------------------
  // Metric 1: Documentation Coverage (Weight: 25)
  // Critical components with at least 1 evidence-backed claim / all critical components
  // -----------------------------------------------------------------
  const criticalWithEvidence = criticalComponents.filter((comp) => {
    const cList = claimsByEntity.get(comp.id) || [];
    return cList.some((c) => c.evidence.length > 0 && c.verifications[0]?.status === "VERIFIED");
  });

  const m1Denominator = criticalComponents.length;
  const m1Numerator = criticalWithEvidence.length;
  const m1HasEvidence = m1Denominator > 0;
  const m1Score = m1HasEvidence ? Math.round((m1Numerator / m1Denominator) * 100) : 0;

  const metric1: MetricBreakdown = {
    name: "Documentation Coverage",
    weight: 25,
    score: m1Score,
    numerator: m1Numerator,
    denominator: m1Denominator,
    hasSufficientEvidence: m1HasEvidence,
    formula: "Critical components with verified evidence-backed claims / Total critical components",
    explanation: m1HasEvidence
      ? `${m1Numerator} of ${m1Denominator} critical component(s) have verified source evidence.`
      : "No critical components identified in workspace.",
  };

  // -----------------------------------------------------------------
  // Metric 2: Decision Traceability (Weight: 20)
  // selected_technology claims that have a matching rationale claim / all selected_technology claims
  // -----------------------------------------------------------------
  const techClaims = claims.filter((c) => c.attributeKey === "selected_technology");
  const techWithRationale = techClaims.filter((tech) => {
    const entClaims = claimsByEntity.get(tech.subjectEntityId) || [];
    return entClaims.some((c) => c.attributeKey === "rationale");
  });

  const m2Denominator = techClaims.length;
  const m2Numerator = techWithRationale.length;
  const m2HasEvidence = m2Denominator > 0;
  const m2Score = m2HasEvidence ? Math.round((m2Numerator / m2Denominator) * 100) : 0;

  const metric2: MetricBreakdown = {
    name: "Decision Traceability",
    weight: 20,
    score: m2Score,
    numerator: m2Numerator,
    denominator: m2Denominator,
    hasSufficientEvidence: m2HasEvidence,
    formula: "Technology decisions with documented rationale / Total technology decisions",
    explanation: m2HasEvidence
      ? `${m2Numerator} of ${m2Denominator} technology choice(s) have documented architectural rationale.`
      : "No technology decision claims extracted.",
  };

  // -----------------------------------------------------------------
  // Metric 3: Ownership Coverage (Weight: 20)
  // Task claims with an assigned owner / all task claims
  // -----------------------------------------------------------------
  const taskEntities = entities.filter((e) => {
    const cList = claimsByEntity.get(e.id) || [];
    return (
      cList.some((c) => c.category === "TASK") ||
      cList.some((c) => c.attributeKey === "status" && c.valueNormalized !== "COMPLETED")
    );
  });

  const tasksWithOwner = taskEntities.filter((task) => {
    const cList = claimsByEntity.get(task.id) || [];
    return cList.some((c) => c.attributeKey === "owner");
  });

  const m3Denominator = taskEntities.length;
  const m3Numerator = tasksWithOwner.length;
  const m3HasEvidence = m3Denominator > 0;
  const m3Score = m3HasEvidence ? Math.round((m3Numerator / m3Denominator) * 100) : 0;

  const metric3: MetricBreakdown = {
    name: "Ownership Coverage",
    weight: 20,
    score: m3Score,
    numerator: m3Numerator,
    denominator: m3Denominator,
    hasSufficientEvidence: m3HasEvidence,
    formula: "Pending tasks with assigned owner / Total pending tasks",
    explanation: m3HasEvidence
      ? `${m3Numerator} of ${m3Denominator} active task(s) have verified owner assignment.`
      : "No pending tasks found.",
  };

  // -----------------------------------------------------------------
  // Metric 4: Dependency Clarity (Weight: 15)
  // depends_on claims where target is a resolved entity with evidence / all depends_on claims
  // -----------------------------------------------------------------
  const depClaims = claims.filter((c) => c.attributeKey === "depends_on");
  const validDeps = depClaims.filter((dep) => {
    const targetName = (dep.valueNormalized || dep.valueRaw).toLowerCase();
    const targetEntity = entities.find((e) => e.canonicalName.toLowerCase() === targetName);
    return targetEntity !== undefined && dep.evidence.length > 0;
  });

  const m4Denominator = depClaims.length;
  const m4Numerator = validDeps.length;
  const m4HasEvidence = m4Denominator > 0;
  const m4Score = m4HasEvidence ? Math.round((m4Numerator / m4Denominator) * 100) : 0;

  const metric4: MetricBreakdown = {
    name: "Dependency Clarity",
    weight: 15,
    score: m4Score,
    numerator: m4Numerator,
    denominator: m4Denominator,
    hasSufficientEvidence: m4HasEvidence,
    formula: "Dependency claims with resolved target entities / Total dependency claims",
    explanation: m4HasEvidence
      ? `${m4Numerator} of ${m4Denominator} inter-component dependency claim(s) resolve to verified entities.`
      : "No inter-component dependency claims recorded.",
  };

  // -----------------------------------------------------------------
  // Metric 5: Handover Readiness (Weight: 20)
  // Accepted claims / non-rejected claims, reduced when conflicts are OPEN
  // -----------------------------------------------------------------
  const acceptedClaims = claims.filter(
    (c) => c.reviewState === "ACCEPTED" || c.reviewState === "EDITED"
  );
  const m5Denominator = claims.length;
  const m5Numerator = acceptedClaims.length;
  const m5HasEvidence = m5Denominator > 0;

  // Base ratio of accepted claims
  const m5RawScore = m5HasEvidence ? (m5Numerator / m5Denominator) * 100 : 0;
  // Penalty: reduce by 10 points for each unresolved open conflict
  const conflictPenalty = openConflicts.length * 10;
  const m5FinalScore = Math.max(0, Math.round(m5RawScore - conflictPenalty));

  const metric5: MetricBreakdown = {
    name: "Handover Readiness",
    weight: 20,
    score: m5FinalScore,
    numerator: m5Numerator,
    denominator: m5Denominator,
    hasSufficientEvidence: m5HasEvidence,
    formula: "(Accepted claims / Total non-rejected claims) * 100 - (Open conflicts * 10)",
    explanation: m5HasEvidence
      ? `${m5Numerator} of ${m5Denominator} claim(s) accepted. (${openConflicts.length} active open conflict penalty applied).`
      : "No claims extracted yet.",
  };

  const allMetrics = [metric1, metric2, metric3, metric4, metric5];

  // -----------------------------------------------------------------
  // Composite Score Calculation with Coverage Handling
  // Missing metrics are NOT treated as 0:
  // Score = sum(weight * metricScore) / sum(availableWeights)
  // -----------------------------------------------------------------
  const availableMetrics = allMetrics.filter((m) => m.hasSufficientEvidence);
  const totalAvailableWeight = availableMetrics.reduce((sum, m) => sum + m.weight, 0);

  let compositeScore: number | null = null;
  let hasSufficientEvidence = false;
  let status: ContinuityScoreResult["status"] = "INSUFFICIENT_EVIDENCE";
  let explanation = "";

  if (totalAvailableWeight >= 60) {
    hasSufficientEvidence = true;
    const weightedSum = availableMetrics.reduce((sum, m) => sum + (m.score * m.weight), 0);
    compositeScore = Math.round(weightedSum / totalAvailableWeight);

    if (compositeScore >= 80) {
      status = "GOOD";
      explanation = "Strong continuity: High documentation coverage, verified ownership, and minimal conflicting knowledge.";
    } else if (compositeScore >= 50) {
      status = "MODERATE";
      explanation = "Moderate continuity: Some critical modules lack secondary owners or explicit technical rationale.";
    } else {
      status = "NEEDS_ATTENTION";
      explanation = "Fragile continuity: Significant gaps in ownership redundancy, unassigned tasks, or unresolved conflicts.";
    }
  } else {
    explanation = `Insufficient evidence (${totalAvailableWeight}% / 60% required): Upload more project documentation to calculate a grounded Continuity Score.`;
  }

  const scoreResult: ContinuityScoreResult = {
    score: compositeScore,
    hasSufficientEvidence,
    availableCoveragePercentage: totalAvailableWeight,
    status,
    explanation,
    metrics: allMetrics,
    disclaimer: "Initial heuristic weights, not validated. This Continuity Score is an explainable knowledge-readiness indicator, not a statistical prediction of project success.",
  };

  // -----------------------------------------------------------------
  // Bus Factor / Ownership Concentration Map
  // -----------------------------------------------------------------
  const busFactorItems: BusFactorItem[] = components.map((comp) => {
    const compClaims = claimsByEntity.get(comp.id) || [];
    const ownerClaims = compClaims.filter((c) => c.attributeKey === "owner");

    const owners = ownerClaims.map((c) => ({
      name: c.valueRaw,
      claimId: c.id,
      evidenceStatus: c.verifications[0]?.status || "UNVERIFIED",
    }));

    const uniqueOwnerNames = new Set(owners.map((o) => o.name.toLowerCase()));
    const busFactor = uniqueOwnerNames.size;
    const isCritical = criticalComponents.some((c) => c.id === comp.id);

    return {
      componentId: comp.id,
      componentName: comp.canonicalName,
      isCritical,
      owners,
      busFactor,
      isSingleOwner: busFactor === 1,
    };
  });

  const singleOwnerCount = busFactorItems.filter((b) => b.isSingleOwner && b.isCritical).length;

  const busFactorResult: BusFactorMapResult = {
    components: busFactorItems,
    totalComponents: busFactorItems.length,
    singleOwnerCount,
    disclaimer: "Ownership-concentration indicator, not a statistical measure. Highlights modules where key knowledge rests with a single contributor.",
  };

  return {
    score: scoreResult,
    busFactor: busFactorResult,
  };
}
