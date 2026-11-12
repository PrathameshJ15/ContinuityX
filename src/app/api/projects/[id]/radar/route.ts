import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { UnauthorizedError, jsonSuccess, handleApiError } from "@/lib/api-response";
import { computeRadarAlertsService } from "@/services/radar";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId } = await params;
    const url = new URL(req.url);
    const ruleId = url.searchParams.get("ruleId") || undefined;
    const status = (url.searchParams.get("status") as "OPEN" | "DISMISSED" | "ALL") || "ALL";

    const data = await computeRadarAlertsService(projectId, user.id, { ruleId, status });

    return jsonSuccess(data);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
