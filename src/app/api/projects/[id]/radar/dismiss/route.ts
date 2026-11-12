import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { UnauthorizedError, BadRequestError, jsonSuccess, handleApiError } from "@/lib/api-response";
import { dismissRadarAlertService } from "@/services/radar";

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
    if (!body?.ruleId || typeof body.ruleId !== "string") {
      throw new BadRequestError("Missing required parameter 'ruleId'");
    }
    if (!body?.reason || typeof body.reason !== "string" || !body.reason.trim()) {
      throw new BadRequestError("A written justification 'reason' is required to dismiss a knowledge loss alert.");
    }

    const dismissal = await dismissRadarAlertService(
      projectId,
      body.alertKey,
      body.ruleId,
      body.reason.trim(),
      user.id
    );

    return jsonSuccess({ dismissal });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
