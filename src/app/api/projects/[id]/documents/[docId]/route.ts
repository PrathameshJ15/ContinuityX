import { NextRequest } from "next/server";
import { getDocumentService, softDeleteDocumentService } from "@/services/documents";
import { jsonSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: projectId, docId } = await params;
    const document = await getDocumentService(projectId, docId);
    return jsonSuccess({ document });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: projectId, docId } = await params;
    const result = await softDeleteDocumentService(projectId, docId);
    return jsonSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
