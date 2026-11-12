import { NextRequest } from "next/server";
import { z } from "zod";
import { ClaimCategory } from "@prisma/client";
import { getClaimService, editCandidateClaimService } from "@/services/claims";
import { jsonSuccess, jsonError, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const editClaimSchema = z.object({
  subjectEntityId: z.string().min(1).optional(),
  attributeKey: z.string().min(1).optional(),
  valueRaw: z.string().min(1).max(2000).optional(),
  category: z.nativeEnum(ClaimCategory).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const { id: projectId, claimId } = await params;
    const claim = await getClaimService(projectId, claimId);
    return jsonSuccess({ claim });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const { id: projectId, claimId } = await params;
    const body = await req.json();
    const parsed = editClaimSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("VALIDATION_ERROR", "Invalid claim update payload.", 400, parsed.error.issues);
    }

    const updatedClaim = await editCandidateClaimService(projectId, claimId, parsed.data);
    return jsonSuccess({ claim: updatedClaim });
  } catch (error) {
    return handleApiError(error);
  }
}
