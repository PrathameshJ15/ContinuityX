import { NextRequest } from "next/server";
import { listEntitiesService, createManualEntityService } from "@/services/entities";
import { createEntitySchema } from "@/services/entities/schema";
import { jsonSuccess, jsonError, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const includeMerged = new URL(req.url).searchParams.get("includeMerged") === "true";
    const entities = await listEntitiesService(projectId, includeMerged);
    return jsonSuccess({ entities });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();
    const parsed = createEntitySchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message || "Invalid entity payload.",
        400,
        parsed.error.issues
      );
    }

    const entity = await createManualEntityService(projectId, parsed.data);
    return jsonSuccess({ entity }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
