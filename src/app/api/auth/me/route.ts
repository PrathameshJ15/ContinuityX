import { getCurrentUser } from "@/lib/auth";
import { jsonSuccess, jsonError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("UNAUTHORIZED", "Not signed in", 401);
  }
  return jsonSuccess({ user });
}
