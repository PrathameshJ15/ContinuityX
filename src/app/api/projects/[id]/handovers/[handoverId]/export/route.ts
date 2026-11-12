import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { UnauthorizedError, handleApiError } from "@/lib/api-response";
import { exportHandoverPdfService, getHandoverByIdService } from "@/services/handover";

interface RouteParams {
  params: Promise<{ id: string; handoverId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId, handoverId } = await params;
    const { handover } = await getHandoverByIdService(projectId, handoverId, user.id);
    const pdfBytes = await exportHandoverPdfService(projectId, handoverId, user.id);

    const safeTitle = handover.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeTitle}-v${handover.version}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBytes.byteLength.toString(),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
