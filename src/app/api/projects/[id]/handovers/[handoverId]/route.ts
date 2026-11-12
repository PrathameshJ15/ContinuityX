import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { UnauthorizedError, jsonSuccess, handleApiError } from "@/lib/api-response";
import { getHandoverByIdService } from "@/services/handover";

interface RouteParams {
  params: Promise<{ id: string; handoverId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId, handoverId } = await params;
    const result = await getHandoverByIdService(projectId, handoverId, user.id);

    return jsonSuccess(result);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
