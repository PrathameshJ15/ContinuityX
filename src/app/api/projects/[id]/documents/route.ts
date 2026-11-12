import { NextRequest } from "next/server";
import { listDocumentsService } from "@/services/documents";
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
    const limit = parseInt(searchParams.get("limit") ?? "10", 10);

    const result = await listDocumentsService(projectId, page, limit);
    return jsonSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
