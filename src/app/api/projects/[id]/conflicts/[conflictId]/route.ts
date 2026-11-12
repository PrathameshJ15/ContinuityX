import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonSuccess, handleApiError, UnauthorizedError } from "@/lib/api-response";
import { getConflictService } from "@/services/conflicts";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; conflictId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId, conflictId } = await params;
    const conflict = await getConflictService(projectId, conflictId, user.id);

    return jsonSuccess({ conflict });
  } catch (error) {
    return handleApiError(error);
  }
}
