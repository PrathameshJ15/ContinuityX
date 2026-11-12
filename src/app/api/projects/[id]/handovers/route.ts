import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { UnauthorizedError, jsonSuccess, handleApiError } from "@/lib/api-response";
import { listHandoversService, approveHandoverService } from "@/services/handover";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId } = await params;
    const handovers = await listHandoversService(projectId, user.id);

    return jsonSuccess({ handovers });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId } = await params;
    const body = await req.json().catch(() => ({}));
    const customTitle = typeof body?.title === "string" ? body.title : undefined;

    const result = await approveHandoverService(projectId, user.id, customTitle);

    return jsonSuccess(result, 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
