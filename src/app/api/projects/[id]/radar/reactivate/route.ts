import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { UnauthorizedError, BadRequestError, jsonSuccess, handleApiError } from "@/lib/api-response";
import { reactivateRadarAlertService } from "@/services/radar";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId } = await params;
    const body = await req.json().catch(() => ({}));

    if (!body?.alertKey || typeof body.alertKey !== "string") {
      throw new BadRequestError("Missing required parameter 'alertKey'");
    }

    const result = await reactivateRadarAlertService(projectId, body.alertKey, user.id);

    return jsonSuccess(result);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
