import { NextRequest } from "next/server";
import { createProjectService, listMyProjectsService } from "@/services/projects";
import { jsonSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "10", 10);

    const result = await listMyProjectsService(page, limit);
    return jsonSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const project = await createProjectService(body);
    return jsonSuccess(project, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
