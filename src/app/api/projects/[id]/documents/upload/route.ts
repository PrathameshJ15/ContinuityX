import { NextRequest } from "next/server";
import { uploadDocumentService } from "@/services/documents";
import { jsonSuccess, jsonError, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return jsonError("BAD_REQUEST", "No document file provided in request.", 400);
    }

    const documentDate = formData.get("documentDate");
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const doc = await uploadDocumentService({
      projectId,
      originalFileName: file.name,
      fileBuffer,
      reportedMimeType: file.type,
      userProvidedDate: typeof documentDate === "string" ? documentDate : null,
    });

    return jsonSuccess(doc, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
