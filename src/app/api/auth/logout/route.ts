import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { jsonSuccess, handleApiError } from "@/lib/api-response";
import { writeAudit } from "@/lib/audit";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) {
      await writeAudit({
        userId: user.id,
        action: "LOGOUT",
        entityType: "AUTH",
        entityId: user.id,
      });
    }

    await clearSessionCookie();
    return jsonSuccess({ message: "Logged out successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
