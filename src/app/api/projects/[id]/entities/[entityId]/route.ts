import { NextRequest } from "next/server";
import { z } from "zod";
import { EntityType } from "@prisma/client";
import { updateEntityService } from "@/services/entities";
import { jsonSuccess, jsonError, handleApiError } from "@/lib/api-response";

const updateEntitySchema = z.object({
  canonicalName: z.string().min(1).max(200).optional(),
  type: z.nativeEnum(EntityType).optional(),
  aliases: z.array(z.string().min(1).max(200)).max(30).optional(),
  needsReview: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entityId: string }> }
) {
  try {
    const { id: projectId, entityId } = await params;
    const body = await req.json();
    const parsed = updateEntitySchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_ERROR", "Invalid entity update payload.", 400, parsed.error.issues);
    }

    const entity = await updateEntityService(projectId, entityId, parsed.data);
    return jsonSuccess({ entity });
  } catch (error) {
    return handleApiError(error);
  }
}
