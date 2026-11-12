import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonSuccess, handleApiError, UnauthorizedError } from "@/lib/api-response";
import { getReviewQueueService } from "@/services/reviews";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId } = await params;
    const queue = await getReviewQueueService(projectId, user.id);

    return jsonSuccess(queue);
  } catch (error) {
    return handleApiError(error);
  }
}
