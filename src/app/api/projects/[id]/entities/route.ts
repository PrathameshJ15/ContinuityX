import { NextRequest } from "next/server";
import { z } from "zod";
import { EntityType } from "@prisma/client";
import { listEntitiesService, createManualEntityService } from "@/services/entities";
import { jsonSuccess, jsonError, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const createEntitySchema = z.object({
  canonicalName: z.string().min(1).max(200),
  type: z.nativeEnum(EntityType),
  aliases: z.array(z.string().min(1).max(200)).max(25).optional(),
});

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
      return jsonError("VALIDATION_ERROR", "Invalid entity payload.", 400, parsed.error.issues);
    }

    const entity = await createManualEntityService(projectId, parsed.data);
    return jsonSuccess({ entity }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
