import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonSuccess, handleApiError, UnauthorizedError, AppError } from "@/lib/api-response";
import { resolveConflictService, ConflictResolutionAction } from "@/services/conflicts";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; conflictId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId, conflictId } = await params;
    const body = await req.json();

    const action = body.action as ConflictResolutionAction;
    const reason = body.reason as string;

    if (!action) {
      throw new AppError("VALIDATION_ERROR", "Action is required.", 400);
    }

    const resolved = await resolveConflictService({
      projectId,
      conflictId,
      action,
      reason,
      userId: user.id,
    });

    return jsonSuccess({ conflict: resolved });
  } catch (error) {
    return handleApiError(error);
  }
}
