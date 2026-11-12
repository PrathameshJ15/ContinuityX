import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonSuccess, handleApiError, UnauthorizedError } from "@/lib/api-response";
import { verifyClaimService } from "@/services/verification";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId, claimId } = await params;
    const result = await verifyClaimService(projectId, claimId, { userId: user.id });

    return jsonSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
