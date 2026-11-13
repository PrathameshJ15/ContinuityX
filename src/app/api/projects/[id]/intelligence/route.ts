import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { UnauthorizedError, jsonSuccess, handleApiError } from "@/lib/api-response";
import { computeContinuityIntelligenceService } from "@/services/intelligence/score";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const startTime = performance.now();
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId } = await params;
    const result = await computeContinuityIntelligenceService(projectId, user.id);

    const duration = performance.now() - startTime;
    console.log(`[API Timing] GET /api/projects/${projectId}/intelligence completed in ${duration.toFixed(2)} ms`);

    const response = jsonSuccess(result);
    response.headers.set("Server-Timing", `total;dur=${duration.toFixed(2)}`);
    return response;
  } catch (err: unknown) {
    const duration = performance.now() - startTime;
    console.log(`[API Timing] GET /api/projects/intelligence failed after ${duration.toFixed(2)} ms`);
    return handleApiError(err);
  }
}
