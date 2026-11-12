import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/permissions";
import { getStorageProvider } from "@/lib/storage";
import { handleApiError, AppError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: projectId, docId } = await params;
    await requireProjectAccess(projectId, "project:read");

    const document = await prisma.document.findFirst({
      where: { id: docId, projectId, deletedAt: null },
      select: { fileName: true, mimeType: true, storageKey: true },
    });

    if (!document) {
      throw new AppError("NOT_FOUND", "Document not found.", 404);
    }

    const storage = getStorageProvider();
    const buffer = await storage.get(document.storageKey);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
