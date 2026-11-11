import { NextRequest } from "next/server";
import { addMemberService } from "@/services/projects";
import { jsonSuccess, handleApiError } from "@/lib/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const membership = await addMemberService(id, body);
    return jsonSuccess(membership, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
