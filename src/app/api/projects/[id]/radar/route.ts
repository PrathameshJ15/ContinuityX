import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { UnauthorizedError, jsonSuccess, handleApiError } from "@/lib/api-response";
import { computeRadarAlertsService } from "@/services/radar";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const startTime = performance.now();
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId } = await params;
    const url = new URL(req.url);
    const ruleId = url.searchParams.get("ruleId") || undefined;
    const status = (url.searchParams.get("status") as "OPEN" | "DISMISSED" | "ALL") || "OPEN";

    const data = await computeRadarAlertsService(projectId, user.id, { ruleId, status });

    const duration = performance.now() - startTime;
    console.log(`[API Timing] GET /api/projects/${projectId}/radar completed in ${duration.toFixed(2)} ms`);

    const response = jsonSuccess(data);
    response.headers.set("Server-Timing", `total;dur=${duration.toFixed(2)}`);
    return response;
  } catch (err: unknown) {
    const duration = performance.now() - startTime;
    console.log(`[API Timing] GET /api/projects/radar failed after ${duration.toFixed(2)} ms`);
    return handleApiError(err);
  }
}
