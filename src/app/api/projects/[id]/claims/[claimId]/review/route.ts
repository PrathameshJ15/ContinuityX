import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonSuccess, handleApiError, UnauthorizedError, AppError } from "@/lib/api-response";
import { reviewClaimService } from "@/services/reviews";
import { ReviewDecision } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId, claimId } = await params;
    const body = await req.json();

    const expectedVersion = Number(body.expectedVersion);
    const decision = body.decision as ReviewDecision;
    const comments = body.comments as string | undefined;
    const reason = body.reason as string | undefined;

    if (!Number.isFinite(expectedVersion)) {
      throw new AppError("VALIDATION_ERROR", "expectedVersion number is required.", 400);
    }

    if (!decision || !Object.values(ReviewDecision).includes(decision)) {
      throw new AppError("VALIDATION_ERROR", "Valid review decision is required.", 400);
    }

    const review = await reviewClaimService({
      projectId,
      claimId,
      expectedVersion,
      decision,
      comments,
      reason,
      userId: user.id,
    });

    return jsonSuccess(review);
  } catch (error) {
    return handleApiError(error);
  }
}
