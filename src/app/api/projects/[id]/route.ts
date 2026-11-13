import { NextRequest } from "next/server";
import { getProjectService, updateProjectService, archiveProjectService } from "@/services/projects";
import { jsonSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = performance.now();
  try {
    const { id } = await params;
    const project = await getProjectService(id);

    const duration = performance.now() - startTime;
    console.log(`[API Timing] GET /api/projects/${id} completed in ${duration.toFixed(2)} ms`);

    const response = jsonSuccess(project);
    response.headers.set("Server-Timing", `total;dur=${duration.toFixed(2)}`);
    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.log(`[API Timing] GET /api/projects failed after ${duration.toFixed(2)} ms`);
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await updateProjectService(id, body);
    return jsonSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const archived = await archiveProjectService(id);
    return jsonSuccess(archived);
  } catch (error) {
    return handleApiError(error);
  }
}
