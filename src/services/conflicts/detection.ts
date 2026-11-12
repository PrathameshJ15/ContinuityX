import {
  ConflictResolutionState,
  ConflictType,
  Prisma,
  SourceDateBasis,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { ATTRIBUTE_VOCABULARY, isControlledAttributeKey } from "@/lib/ai/vocabulary";

/**
 * Determines conflict type based on attributeKey per SPEC.md V3.2 Section 4.
 */
export function determineConflictType(attributeKey: string): ConflictType {
  switch (attributeKey) {
    case "status":
      return "STATUS_CONFLICT";
    case "owner":
      return "OWNERSHIP_CONFLICT";
    case "selected_technology":
      return "DECISION_CONFLICT";
    case "due_date":
      return "TIMELINE_CONFLICT";
    default:
      return "VALUE_CONFLICT";
  }
}

export interface DocumentDateMetadata {
  sourceDate: Date | null;
  sourceDateBasis: SourceDateBasis;
}

/**
 * Determines conflict initial resolution state:
 * - If both source documents have a reliable date (basis is not UNKNOWN) and the dates differ,
 *   set resolution state POSSIBLY_SUPERSEDED.
 * - Otherwise set OPEN.
 * - A human always confirms; never auto-resolve.
 */
export function evaluateConflictChronology(
  docA?: DocumentDateMetadata | null,
  docB?: DocumentDateMetadata | null
): ConflictResolutionState {
  if (
    docA?.sourceDate &&
    docA.sourceDateBasis !== "UNKNOWN" &&
    docB?.sourceDate &&
    docB.sourceDateBasis !== "UNKNOWN"
  ) {
    const timeA = new Date(docA.sourceDate).getTime();
    const timeB = new Date(docB.sourceDate).getTime();
    if (timeA !== timeB) {
      return "POSSIBLY_SUPERSEDED";
    }
  }

  return "OPEN";
}

/**
 * Scans and creates/updates conflicts for a specific claim against all active claims in the project.
 */
export async function detectConflictsForClaim(
  projectId: string,
  claimId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const claim = await tx.claim.findFirst({
    where: { id: claimId, projectId },
    include: {
      evidence: {
        include: {
          document: {
            select: { sourceDate: true, sourceDateBasis: true },
          },
        },
        take: 1,
      },
    },
  });

  if (!claim || claim.reviewState === "REJECTED" || !claim.valueNormalized) {
    return [];
  }

  // Check if attribute is single-valued and triggers conflict
  if (isControlledAttributeKey(claim.attributeKey)) {
    const def = ATTRIBUTE_VOCABULARY[claim.attributeKey];
    if (def.cardinality !== "SINGLE" || !def.triggersConflict) {
      return [];
    }
  }

  // Find candidate competing claims with same canonical subject entity & same attributeKey
  const competingClaims = await tx.claim.findMany({
    where: {
      projectId,
      subjectEntityId: claim.subjectEntityId,
      attributeKey: claim.attributeKey,
      id: { not: claim.id },
      reviewState: { not: "REJECTED" },
      valueNormalized: { not: null },
      supersededBy: { none: {} }, // latest active versions only
    },
    include: {
      evidence: {
        include: {
          document: {
            select: { sourceDate: true, sourceDateBasis: true },
          },
        },
        take: 1,
      },
    },
  });

  const createdOrUpdatedConflicts = [];

  for (const competitor of competingClaims) {
    // Only conflict if normalized values are different
    if (competitor.valueNormalized === claim.valueNormalized) {
      continue;
    }

    // Canonical ordering: claimAId < claimBId to respect unique constraint
    const [claimAId, claimBId] =
      claim.id < competitor.id ? [claim.id, competitor.id] : [competitor.id, claim.id];

    const docA =
      claimAId === claim.id
        ? claim.evidence[0]?.document
        : competitor.evidence[0]?.document;
    const docB =
      claimBId === claim.id
        ? claim.evidence[0]?.document
        : competitor.evidence[0]?.document;

    const conflictType = determineConflictType(claim.attributeKey);
    const initialStatus = evaluateConflictChronology(docA, docB);

    // Upsert conflict record
    const conflict = await tx.conflict.upsert({
      where: {
        claimAId_claimBId: {
          claimAId,
          claimBId,
        },
      },
      update: {
        conflictType,
        // Only set status if previously resolved or if freshly updated
      },
      create: {
        projectId,
        subjectEntityId: claim.subjectEntityId,
        attributeKey: claim.attributeKey,
        claimAId,
        claimBId,
        conflictType,
        status: initialStatus,
      },
    });

    createdOrUpdatedConflicts.push(conflict);
  }

  return createdOrUpdatedConflicts;
}

/**
 * Checks whether a given claim is involved in any active unresolved (OPEN) conflict.
 */
export async function claimHasOpenConflict(
  claimId: string,
  tx: Prisma.TransactionClient = prisma
): Promise<boolean> {
  const openConflict = await tx.conflict.findFirst({
    where: {
      OR: [{ claimAId: claimId }, { claimBId: claimId }],
      status: "OPEN",
    },
    select: { id: true },
  });

  return Boolean(openConflict);
}

/**
 * Scans all claims in a project and detects all pairwise conflicts.
 */
export async function detectAllProjectConflicts(
  projectId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const claims = await tx.claim.findMany({
    where: {
      projectId,
      reviewState: { not: "REJECTED" },
      valueNormalized: { not: null },
      supersededBy: { none: {} },
    },
    select: { id: true },
  });

  const conflicts = [];
  for (const c of claims) {
    const cConflicts = await detectConflictsForClaim(projectId, c.id, tx);
    conflicts.push(...cConflicts);
  }

  return conflicts;
}
