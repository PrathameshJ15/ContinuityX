import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { jsonSuccess, jsonError, handleApiError } from "@/lib/api-response";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limiter";

const LoginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = LoginSchema.safeParse(body);

    if (!validated.success) {
      return jsonError("VALIDATION_ERROR", "Invalid email or password format", 400);
    }

    const { email, password } = validated.data;

    // Rate limiting: max 5 login attempts per 60 seconds per email
    const rateLimit = checkRateLimit(`login_${email}`, 5, 60000);
    if (!rateLimit.allowed) {
      await writeAudit({
        action: "LOGIN_RATE_LIMITED",
        entityType: "AUTH",
        entityId: email,
        metadata: { email, resetInSeconds: rateLimit.resetInSeconds },
      });

      return jsonError(
        "RATE_LIMITED",
        `Too many failed login attempts. Please try again in ${rateLimit.resetInSeconds} seconds.`,
        429
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Timing-safe password verification & no user enumeration
    const isPasswordValid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !isPasswordValid) {
      await writeAudit({
        userId: user?.id ?? null,
        action: "LOGIN_FAILED",
        entityType: "AUTH",
        entityId: email,
        metadata: { email },
      });

      // Unified error message for both non-existent users and bad passwords
      return jsonError("UNAUTHORIZED", "Invalid email or password.", 401);
    }

    // Reset rate limiter on successful authentication
    resetRateLimit(`login_${email}`);

    const token = await createSessionToken({
      id: user.id,
      name: user.name,
      email: user.email,
    });

    await setSessionCookie(token);

    await writeAudit({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      entityType: "AUTH",
      entityId: user.id,
      metadata: { email: user.email },
    });

    return jsonSuccess({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
