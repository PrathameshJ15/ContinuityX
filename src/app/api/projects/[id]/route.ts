import { NextRequest } from "next/server";
import { getProjectService, updateProjectService, archiveProjectService } from "@/services/projects";
import { jsonSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProjectService(id);
    return jsonSuccess(project);
  } catch (error) {
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
