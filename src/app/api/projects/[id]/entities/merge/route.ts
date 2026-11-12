import { NextRequest } from "next/server";
import { z } from "zod";
import { mergeEntitiesService } from "@/services/entities";
import { jsonSuccess, jsonError, handleApiError } from "@/lib/api-response";

const mergeSchema = z.object({
  sourceEntityId: z.string().min(1),
  targetEntityId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();
    const parsed = mergeSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_ERROR", "Invalid merge payload.", 400, parsed.error.issues);
    }

    const result = await mergeEntitiesService(
      projectId,
      parsed.data.sourceEntityId,
      parsed.data.targetEntityId
    );
    return jsonSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
