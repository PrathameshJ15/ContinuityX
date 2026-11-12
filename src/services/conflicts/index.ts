import { ConflictResolutionState, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/api-response";
import { verifyClaimService } from "@/services/verification";

export type ConflictResolutionAction =
  | "CHOOSE_A"
  | "CHOOSE_B"
  | "KEEP_BOTH"
  | "CONFIRM_SUPERSEDED"
  | "REQUIRES_CLARIFICATION";

export interface ResolveConflictInput {
  projectId: string;
  conflictId: string;
  action: ConflictResolutionAction;
  reason: string;
  userId?: string;
}

export async function listConflictsService(
  projectId: string,
  filters: { status?: ConflictResolutionState } = {},
  userId?: string
) {
  await requireProjectAccess(projectId, "claims:view_unapproved", userId);

  const where: Prisma.ConflictWhereInput = { projectId };
  if (filters.status) {
    where.status = filters.status;
  }

  const conflicts = await prisma.conflict.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      subjectEntity: {
        select: { id: true, canonicalName: true, type: true },
      },
      claimA: {
        include: {
          evidence: {
            include: {
              document: {
                select: { id: true, fileName: true, sourceDate: true, sourceDateBasis: true },
              },
            },
            take: 1,
          },
          verifications: {
            orderBy: { verifiedAt: "desc" },
            take: 1,
          },
        },
      },
      claimB: {
        include: {
          evidence: {
            include: {
              document: {
                select: { id: true, fileName: true, sourceDate: true, sourceDateBasis: true },
              },
            },
            take: 1,
          },
          verifications: {
            orderBy: { verifiedAt: "desc" },
            take: 1,
          },
        },
      },
      resolvedByUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return conflicts;
}

export async function getConflictService(
  projectId: string,
  conflictId: string,
  userId?: string
) {
  await requireProjectAccess(projectId, "claims:view_unapproved", userId);

  const conflict = await prisma.conflict.findFirst({
    where: { id: conflictId, projectId },
    include: {
      subjectEntity: {
        select: { id: true, canonicalName: true, type: true },
      },
      claimA: {
        include: {
          evidence: {
            include: {
              document: true,
              chunk: true,
            },
          },
          verifications: {
            orderBy: { verifiedAt: "desc" },
            take: 1,
          },
        },
      },
      claimB: {
        include: {
          evidence: {
            include: {
              document: true,
              chunk: true,
            },
          },
          verifications: {
            orderBy: { verifiedAt: "desc" },
            take: 1,
          },
        },
      },
      resolvedByUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!conflict) {
    throw new AppError("NOT_FOUND", "Conflict record not found.", 404);
  }

  return conflict;
}

/**
 * Resolves a pairwise conflict with explicit reviewer reasoning and audit logging.
 * Atomically transitions conflict status, updates claims where applicable,
 * writes ReviewAction, and re-triggers verification for both claims.
 */
export async function resolveConflictService(input: ResolveConflictInput) {
  const { user } = await requireProjectAccess(
    input.projectId,
    "review:claims_conflicts_entities",
    input.userId
  );

  const reasonClean = input.reason?.trim();
  if (!reasonClean) {
    throw new AppError("VALIDATION_ERROR", "A written resolution reason is required.", 400);
  }

  const conflict = await prisma.conflict.findFirst({
    where: { id: input.conflictId, projectId: input.projectId },
    include: {
      claimA: true,
      claimB: true,
    },
  });

  if (!conflict) {
    throw new AppError("NOT_FOUND", "Conflict not found.", 404);
  }

  // Validate special actions
  if (input.action === "KEEP_BOTH" && conflict.attributeKey !== "owner") {
    throw new AppError(
      "BAD_REQUEST",
      `The action 'KEEP_BOTH' is only permitted for 'owner' attributes (e.g. co-owners). Attribute '${conflict.attributeKey}' is strictly single-valued.`,
      400
    );
  }

  let nextConflictStatus: ConflictResolutionState;
  let claimAUpdate: Prisma.ClaimUpdateInput | null = null;
  let claimBUpdate: Prisma.ClaimUpdateInput | null = null;

  switch (input.action) {
    case "CHOOSE_A":
      nextConflictStatus = "RESOLVED_ONE_ACCEPTED";
      claimBUpdate = { reviewState: "REJECTED" };
      break;

    case "CHOOSE_B":
      nextConflictStatus = "RESOLVED_ONE_ACCEPTED";
      claimAUpdate = { reviewState: "REJECTED" };
      break;

    case "KEEP_BOTH":
      nextConflictStatus = "RESOLVED_MUTUAL_ACCEPT";
      break;

    case "CONFIRM_SUPERSEDED":
      nextConflictStatus = "RESOLVED_ONE_ACCEPTED";
      // Determine which claim is older by document sourceDate
      const docA = await prisma.claimEvidence.findFirst({
        where: { claimId: conflict.claimAId },
        include: { document: true },
      });
      const docB = await prisma.claimEvidence.findFirst({
        where: { claimId: conflict.claimBId },
        include: { document: true },
      });

      const dateA = docA?.document.sourceDate ? new Date(docA.document.sourceDate).getTime() : 0;
      const dateB = docB?.document.sourceDate ? new Date(docB.document.sourceDate).getTime() : 0;

      if (dateA && dateB && dateA !== dateB) {
        if (dateA < dateB) {
          claimAUpdate = { reviewState: "REJECTED" };
        } else {
          claimBUpdate = { reviewState: "REJECTED" };
        }
      } else {
        // If dates are identical or unknown, require explicit choice instead
        throw new AppError(
          "BAD_REQUEST",
          "Cannot automatically confirm supersession: source document dates are identical or unknown.",
          400
        );
      }
      break;

    case "REQUIRES_CLARIFICATION":
      nextConflictStatus = "REQUIRES_CLARIFICATION";
      break;

    default:
      throw new AppError("BAD_REQUEST", `Unsupported conflict resolution action: ${input.action}`, 400);
  }

  const beforeState = {
    status: conflict.status,
    claimAReviewState: conflict.claimA.reviewState,
    claimBReviewState: conflict.claimB.reviewState,
  };

  // Execute database transaction atomically
  const updatedConflict = await prisma.$transaction(async (tx) => {
    if (claimAUpdate) {
      await tx.claim.update({
        where: { id: conflict.claimAId },
        data: claimAUpdate,
      });
    }

    if (claimBUpdate) {
      await tx.claim.update({
        where: { id: conflict.claimBId },
        data: claimBUpdate,
      });
    }

    const res = await tx.conflict.update({
      where: { id: conflict.id },
      data: {
        status: nextConflictStatus,
        resolutionNotes: reasonClean,
        resolvedByUserId: user.id,
        resolvedAt: new Date(),
      },
    });

    await tx.reviewAction.create({
      data: {
        projectId: input.projectId,
        userId: user.id,
        actionType: "CONFLICT_RESOLVED",
        targetId: conflict.id,
        targetType: "CONFLICT",
        beforeState: beforeState as unknown as Prisma.InputJsonValue,
        afterState: {
          status: nextConflictStatus,
          action: input.action,
        } as unknown as Prisma.InputJsonValue,
        reason: reasonClean,
      },
    });

    return res;
  });

  await writeAudit({
    projectId: input.projectId,
    userId: user.id,
    action: "CONFLICT_RESOLVED",
    entityType: "Conflict",
    entityId: conflict.id,
    metadata: {
      action: input.action,
      nextStatus: nextConflictStatus,
      reason: reasonClean,
    },
  });

  // Re-run verification for both affected claims now that conflict state has changed
  try {
    await verifyClaimService(input.projectId, conflict.claimAId, { userId: user.id });
    await verifyClaimService(input.projectId, conflict.claimBId, { userId: user.id });
  } catch {
    // Non-blocking: background re-verification can run asynchronously
  }

  return updatedConflict;
}
