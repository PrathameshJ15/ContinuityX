import { Prisma, ReviewDecision } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/api-response";
import { claimHasOpenConflict } from "@/services/conflicts/detection";
import { verifyClaimService } from "@/services/verification";

export interface ReviewClaimInput {
  projectId: string;
  claimId: string;
  expectedVersion: number;
  decision: ReviewDecision;
  comments?: string;
  reason?: string; // Required when accepting non-VERIFIED claims
  userId?: string;
}

export async function reviewClaimService(input: ReviewClaimInput) {
  const { user } = await requireProjectAccess(
    input.projectId,
    "review:claims_conflicts_entities",
    input.userId
  );

  const claim = await prisma.claim.findFirst({
    where: { id: input.claimId, projectId: input.projectId },
    include: {
      verifications: {
        orderBy: { verifiedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!claim) {
    throw new AppError("NOT_FOUND", "Claim not found.", 404);
  }

  // 1. Optimistic Concurrency Check
  if (claim.version !== input.expectedVersion) {
    throw new AppError(
      "CONFLICT",
      "Claim was modified by another reviewer. Please refresh and review the latest version.",
      409,
      { currentVersion: claim.version, expectedVersion: input.expectedVersion }
    );
  }

  const latestVerification = claim.verifications[0];
  const evidenceStatus = latestVerification?.status || "UNVERIFIED";

  // 2. Decision Rules Enforcement
  if (input.decision === "ACCEPTED") {
    // Rule: Claim in an OPEN conflict CANNOT be accepted
    const hasOpenConflict = await claimHasOpenConflict(claim.id);
    if (hasOpenConflict) {
      throw new AppError(
        "BAD_REQUEST",
        "A claim in an OPEN conflict cannot be accepted until the conflict is resolved.",
        400
      );
    }

    // Rule: Accepting non-VERIFIED claim requires written reason
    if (evidenceStatus !== "VERIFIED") {
      const reasonClean = input.reason?.trim() || input.comments?.trim();
      if (!reasonClean) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Accepting a claim with evidence status '${evidenceStatus}' requires an explicit written reason.`,
          400
        );
      }
    }
  }

  const beforeState = {
    reviewState: claim.reviewState,
    version: claim.version,
    evidenceStatus,
  };

  const reasonText = input.reason?.trim() || input.comments?.trim() || null;

  // 3. Atomic Database Transaction
  const result = await prisma.$transaction(async (tx) => {
    let nextReviewState = claim.reviewState;
    if (input.decision === "ACCEPTED") nextReviewState = "ACCEPTED";
    if (input.decision === "REJECTED") nextReviewState = "REJECTED";
    if (input.decision === "EDITED") nextReviewState = "EDITED";

    const updatedClaim = await tx.claim.update({
      where: { id: claim.id },
      data: { reviewState: nextReviewState },
    });

    const review = await tx.review.create({
      data: {
        claimId: claim.id,
        projectId: input.projectId,
        reviewerId: user.id,
        decision: input.decision,
        comments: reasonText,
      },
    });

    await tx.reviewAction.create({
      data: {
        reviewId: review.id,
        projectId: input.projectId,
        userId: user.id,
        actionType:
          input.decision === "ACCEPTED"
            ? "CLAIM_ACCEPTED"
            : input.decision === "REJECTED"
              ? "CLAIM_REJECTED"
              : "CLAIM_EDITED",
        targetId: claim.id,
        targetType: "CLAIM",
        beforeState: beforeState as unknown as Prisma.InputJsonValue,
        afterState: {
          reviewState: nextReviewState,
          decision: input.decision,
        } as unknown as Prisma.InputJsonValue,
        reason: reasonText,
      },
    });

    return { updatedClaim, review };
  });

  await writeAudit({
    projectId: input.projectId,
    userId: user.id,
    action: `CLAIM_${input.decision}`,
    entityType: "Claim",
    entityId: claim.id,
    metadata: {
      decision: input.decision,
      previousReviewState: claim.reviewState,
      evidenceStatus,
      reason: reasonText,
    },
  });

  // If rejected, re-verify competing claims in any open conflict involving this claim
  if (input.decision === "REJECTED") {
    try {
      const associatedConflicts = await prisma.conflict.findMany({
        where: {
          projectId: input.projectId,
          OR: [{ claimAId: claim.id }, { claimBId: claim.id }],
        },
      });

      for (const conf of associatedConflicts) {
        const otherClaimId = conf.claimAId === claim.id ? conf.claimBId : conf.claimAId;
        await verifyClaimService(input.projectId, otherClaimId, { userId: user.id });
      }
    } catch {
      // Non-blocking background re-evaluation
    }
  }

  return result;
}

export async function getReviewQueueService(
  projectId: string,
  userId?: string
) {
  await requireProjectAccess(projectId, "claims:view_unapproved", userId);

  // Fetch all latest version claims and open conflict count in parallel
  const [claims, openConflictsCount] = await Promise.all([
    prisma.claim.findMany({
      where: {
        projectId,
        supersededBy: { none: {} },
      },
      include: {
        subjectEntity: {
          include: { aliases: true },
        },
        evidence: {
          include: {
            document: {
              select: { id: true, fileName: true, sourceDate: true, sourceDateBasis: true },
            },
            chunk: true,
          },
        },
        verifications: {
          orderBy: { verifiedAt: "desc" },
          take: 1,
        },
        conflictsAsA: {
          where: { status: "OPEN" },
        },
        conflictsAsB: {
          where: { status: "OPEN" },
        },
      },
    }),
    prisma.conflict.count({
      where: { projectId, status: "OPEN" },
    }),
  ]);

  const totalClaims = claims.length;
  const pendingClaims = claims.filter((c) => c.reviewState === "PENDING");
  const acceptedClaims = claims.filter((c) => c.reviewState === "ACCEPTED");
  const rejectedClaims = claims.filter((c) => c.reviewState === "REJECTED");

  // Prioritize queue order:
  // 1. Claims in OPEN conflicts first
  // 2. UNVERIFIED
  // 3. WEAK_SUPPORT
  // 4. UNKNOWN
  // 5. VERIFIED
  const priorityRank = (claim: (typeof claims)[0]): number => {
    const hasOpenConflict = claim.conflictsAsA.length > 0 || claim.conflictsAsB.length > 0;
    if (hasOpenConflict) return 1;

    const status = claim.verifications[0]?.status;
    switch (status) {
      case "UNVERIFIED":
        return 2;
      case "WEAK_SUPPORT":
        return 3;
      case "UNKNOWN":
        return 4;
      case "CONFLICTING":
        return 1.5;
      case "VERIFIED":
        return 5;
      default:
        return 2.5;
    }
  };

  const queueItems = pendingClaims
    .sort((a, b) => {
      const rankA = priorityRank(a);
      const rankB = priorityRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })
    .map((c) => ({
      id: c.id,
      subjectEntity: c.subjectEntity,
      attributeKey: c.attributeKey,
      valueRaw: c.valueRaw,
      valueNormalized: c.valueNormalized,
      category: c.category,
      reviewState: c.reviewState,
      version: c.version,
      injectionFlag: c.injectionFlag,
      evidence: c.evidence,
      latestVerification: c.verifications[0] || null,
      hasOpenConflict: c.conflictsAsA.length > 0 || c.conflictsAsB.length > 0,
      createdAt: c.createdAt,
    }));

  return {
    metrics: {
      totalClaims,
      pendingCount: pendingClaims.length,
      acceptedCount: acceptedClaims.length,
      rejectedCount: rejectedClaims.length,
      openConflictsCount,
    },
    queue: queueItems,
  };
}
