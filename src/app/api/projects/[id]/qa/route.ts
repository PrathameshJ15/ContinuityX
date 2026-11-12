import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { UnauthorizedError, BadRequestError, jsonSuccess, handleApiError } from "@/lib/api-response";
import { askHandoverQuestionService } from "@/services/intelligence/qa";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId } = await params;
    const body = await req.json().catch(() => ({}));

    if (!body?.question || typeof body.question !== "string" || !body.question.trim()) {
      throw new BadRequestError("A valid, non-empty 'question' string is required.");
    }

    const result = await askHandoverQuestionService({
      projectId,
      question: body.question.trim(),
      userId: user.id,
    });

    return jsonSuccess(result);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
