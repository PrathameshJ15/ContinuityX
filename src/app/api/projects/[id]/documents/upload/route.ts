import { NextRequest } from "next/server";
import { uploadDocumentService } from "@/services/documents";
import { jsonSuccess, jsonError, handleApiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Rate limiting: max 15 document uploads per 60 seconds per project
    const rateLimit = checkRateLimit(`upload_${projectId}`, 15, 60000);
    if (!rateLimit.allowed) {
      return jsonError(
        "RATE_LIMITED",
        `Upload rate limit reached for this project. Please wait ${rateLimit.resetInSeconds} seconds before uploading more documents.`,
        429
      );
    }

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
