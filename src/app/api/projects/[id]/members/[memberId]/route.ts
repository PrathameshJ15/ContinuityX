import { NextRequest } from "next/server";
import { changeMemberRoleService, removeMemberService } from "@/services/projects";
import { jsonSuccess, jsonError, handleApiError } from "@/lib/api-response";
import { ProjectRole } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const body = await req.json();

    if (!body.role || !Object.values(ProjectRole).includes(body.role)) {
      return jsonError("VALIDATION_ERROR", "Invalid or missing role parameter", 400);
    }

    const updated = await changeMemberRoleService(id, memberId, body.role);
    return jsonSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const result = await removeMemberService(id, memberId);
    return jsonSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
