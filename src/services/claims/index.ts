import { ClaimCategory, EvidenceStatus, Prisma, ReviewState } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/api-response";
import { isControlledAttributeKey, normalizeClaimValue } from "@/lib/ai/vocabulary";

export interface ListClaimsFilters {
  page?: number;
  limit?: number;
  category?: ClaimCategory;
  attributeKey?: string;
  entityId?: string;
  documentId?: string;
  injectionFlag?: boolean;
  needsNormalization?: boolean;
  reviewState?: ReviewState;
  evidenceStatus?: EvidenceStatus;
  latestOnly?: boolean;
}

export async function listClaimsService(
  projectId: string,
  filters: ListClaimsFilters = {},
  explicitUserId?: string
) {
  await requireProjectAccess(projectId, "claims:view_unapproved", explicitUserId);

  const safePage = Math.max(1, Number.isFinite(filters.page) ? Number(filters.page) : 1);
  const safeLimit = Math.min(50, Math.max(1, Number.isFinite(filters.limit) ? Number(filters.limit) : 20));
  const skip = (safePage - 1) * safeLimit;

  const where: Prisma.ClaimWhereInput = {
    projectId,
  };

  if (filters.category) where.category = filters.category;
  if (filters.attributeKey) where.attributeKey = filters.attributeKey;
  if (filters.entityId) where.subjectEntityId = filters.entityId;
  if (typeof filters.injectionFlag === "boolean") where.injectionFlag = filters.injectionFlag;
  if (filters.needsNormalization === true) where.valueNormalized = null;
  if (filters.reviewState) where.reviewState = filters.reviewState;
  if (filters.evidenceStatus) {
    where.verifications = {
      some: {
        status: filters.evidenceStatus,
      },
    };
  }
  if (filters.documentId) {
    where.evidence = { some: { documentId: filters.documentId } };
  }
  if (filters.latestOnly !== false) {
    // Only show head versions (not superseded by an edited version)
    where.supersededBy = { none: {} };
  }

  const [total, claims] = await Promise.all([
    prisma.claim.count({ where }),
    prisma.claim.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: [{ injectionFlag: "desc" }, { createdAt: "desc" }],
      include: {
        subjectEntity: {
          select: {
            id: true,
            canonicalName: true,
            type: true,
            needsReview: true,
          },
        },
        evidence: {
          include: {
            document: {
              select: {
                id: true,
                fileName: true,
                sourceDate: true,
                sourceDateBasis: true,
                deletedAt: true,
              },
            },
          },
        },
        verifications: {
          orderBy: { verifiedAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  return {
    claims,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

export async function getClaimService(
  projectId: string,
  claimId: string,
  explicitUserId?: string
) {
  await requireProjectAccess(projectId, "claims:view_unapproved", explicitUserId);

  const claim = await prisma.claim.findFirst({
    where: { id: claimId, projectId },
    include: {
      subjectEntity: {
        include: { aliases: true },
      },
      verifications: {
        orderBy: { verifiedAt: "desc" },
        take: 5,
      },
      extractionRun: {
        select: {
          id: true,
          model: true,
          promptVersion: true,
          schemaVersion: true,
          status: true,
          startedAt: true,
        },
      },
      evidence: {
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              sourceDate: true,
              sourceDateBasis: true,
              deletedAt: true,
            },
          },
          chunk: {
            select: {
              id: true,
              chunkIndex: true,
              content: true,
              pageNumber: true,
              sectionTitle: true,
              rowStart: true,
              rowEnd: true,
              injectionFlag: true,
            },
          },
        },
      },
    },
  });

  if (!claim) {
    throw new AppError("NOT_FOUND", "Claim not found.", 404);
  }

  return claim;
}

export interface EditCandidateClaimInput {
  subjectEntityId?: string;
  attributeKey?: string;
  valueRaw?: string;
  category?: ClaimCategory;
}

/**
 * Reviewer edit of a candidate claim prior to verification/approval.
 * Creates a new version (`version + 1`, `supersedesClaimId`), resets reviewState to PENDING,
 * preserves source evidence links, and writes an AuditLog entry.
 */
export async function editCandidateClaimService(
  projectId: string,
  claimId: string,
  input: EditCandidateClaimInput,
  explicitUserId?: string
) {
  const { user } = await requireProjectAccess(
    projectId,
    "review:claims_conflicts_entities",
    explicitUserId
  );

  const existing = await prisma.claim.findFirst({
    where: { id: claimId, projectId },
    include: { evidence: true },
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Claim not found.", 404);
  }

  const nextAttributeKey = input.attributeKey ?? existing.attributeKey;
  if (!isControlledAttributeKey(nextAttributeKey)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Unsupported controlled attributeKey '${nextAttributeKey}'.`,
      400
    );
  }

  const nextSubjectEntityId = input.subjectEntityId ?? existing.subjectEntityId;
  if (nextSubjectEntityId !== existing.subjectEntityId) {
    const entity = await prisma.entity.findFirst({
      where: { id: nextSubjectEntityId, projectId, mergedIntoId: null },
    });
    if (!entity) {
      throw new AppError("NOT_FOUND", "Target subject entity not found in this project.", 404);
    }
  }

  const nextValueRaw = (input.valueRaw ?? existing.valueRaw).trim();
  if (!nextValueRaw) {
    throw new AppError("VALIDATION_ERROR", "Claim valueRaw cannot be empty.", 400);
  }

  const nextValueNormalized = normalizeClaimValue(nextAttributeKey, nextValueRaw);
  const nextCategory = input.category ?? existing.category;

  const nextClaim = await prisma.$transaction(async (tx) => {
    const created = await tx.claim.create({
      data: {
        projectId,
        subjectEntityId: nextSubjectEntityId,
        attributeKey: nextAttributeKey,
        valueRaw: nextValueRaw,
        valueNormalized: nextValueNormalized,
        category: nextCategory,
        reviewState: ReviewState.PENDING,
        version: existing.version + 1,
        supersedesClaimId: existing.id,
        extractionRunId: existing.extractionRunId,
        injectionFlag: existing.injectionFlag,
        confidence: existing.confidence,
        evidence: {
          create: existing.evidence.map((ev) => ({
            documentId: ev.documentId,
            chunkId: ev.chunkId,
            sourceLocation: ev.sourceLocation,
            excerpt: ev.excerpt,
            evidenceType: ev.evidenceType,
          })),
        },
      },
      include: {
        subjectEntity: true,
        evidence: true,
      },
    });

    return created;
  }, { maxWait: 30000, timeout: 60000 });

  await writeAudit({
    projectId,
    userId: user.id,
    action: "CLAIM_EDITED",
    entityType: "CLAIM",
    entityId: nextClaim.id,
    metadata: {
      supersedesClaimId: existing.id,
      version: nextClaim.version,
      attributeKey: nextClaim.attributeKey,
      valueNormalized: nextClaim.valueNormalized,
    },
  });

  // Re-verify new version and scan for conflicts
  try {
    const { verifyClaimService } = await import("@/services/verification");
    await verifyClaimService(projectId, nextClaim.id, { userId: user.id });
  } catch {
    // Non-blocking: will be picked up in review queue / verify batch
  }

  return nextClaim;
}
