import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonSuccess, handleApiError, UnauthorizedError } from "@/lib/api-response";
import { getReviewQueueService } from "@/services/reviews";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = performance.now();
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId } = await params;
    const queue = await getReviewQueueService(projectId, user.id);

    const duration = performance.now() - startTime;
    console.log(`[API Timing] GET /api/projects/${projectId}/review/queue completed in ${duration.toFixed(2)} ms`);

    const response = jsonSuccess(queue);
    response.headers.set("Server-Timing", `total;dur=${duration.toFixed(2)}`);
    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.log(`[API Timing] GET /api/projects/review/queue failed after ${duration.toFixed(2)} ms`);
    return handleApiError(error);
  }
}
