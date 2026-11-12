import { NextRequest } from "next/server";
import { extractDocumentClaimsService } from "@/services/extraction";
import { jsonSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: projectId, docId } = await params;
    const result = await extractDocumentClaimsService(projectId, docId);
    return jsonSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
