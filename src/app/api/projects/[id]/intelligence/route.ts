import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { UnauthorizedError, jsonSuccess, handleApiError } from "@/lib/api-response";
import { computeContinuityIntelligenceService } from "@/services/intelligence/score";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId } = await params;
    const result = await computeContinuityIntelligenceService(projectId, user.id);

    return jsonSuccess(result);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
