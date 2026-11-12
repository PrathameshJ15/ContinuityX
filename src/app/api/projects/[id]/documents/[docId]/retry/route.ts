import { NextRequest } from "next/server";
import { retryDocumentProcessingService } from "@/services/documents";
import { jsonSuccess, handleApiError } from "@/lib/api-response";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: projectId, docId } = await params;
    const result = await retryDocumentProcessingService(projectId, docId);
    return jsonSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
