import { NextRequest } from "next/server";
import { ClaimCategory, ReviewState } from "@prisma/client";
import { listClaimsService } from "@/services/claims";
import { jsonSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const categoryParam = searchParams.get("category");
    const attributeKey = searchParams.get("attributeKey") || undefined;
    const entityId = searchParams.get("entityId") || undefined;
    const documentId = searchParams.get("documentId") || undefined;
    const injectionFlagParam = searchParams.get("injectionFlag");
    const needsNormParam = searchParams.get("needsNormalization");
    const reviewStateParam = searchParams.get("reviewState");

    const category =
      categoryParam && Object.values(ClaimCategory).includes(categoryParam as ClaimCategory)
        ? (categoryParam as ClaimCategory)
        : undefined;

    const reviewState =
      reviewStateParam && Object.values(ReviewState).includes(reviewStateParam as ReviewState)
        ? (reviewStateParam as ReviewState)
        : undefined;

    const result = await listClaimsService(projectId, {
      page,
      limit,
      category,
      attributeKey,
      entityId,
      documentId,
      injectionFlag:
        injectionFlagParam === "true"
          ? true
          : injectionFlagParam === "false"
            ? false
            : undefined,
      needsNormalization: needsNormParam === "true" ? true : undefined,
      reviewState,
    });

    return jsonSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
