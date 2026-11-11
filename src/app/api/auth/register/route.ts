import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { jsonSuccess, jsonError, handleApiError } from "@/lib/api-response";
import { writeAudit } from "@/lib/audit";

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Please provide a valid email address").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = RegisterSchema.safeParse(body);

    if (!validated.success) {
      return jsonError("VALIDATION_ERROR", "Invalid input data", 400, validated.error.flatten().fieldErrors);
    }

    const { name, email, password } = validated.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return jsonError("CONFLICT", "An account with this email address already exists.", 409);
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    const token = await createSessionToken({
      id: user.id,
      name: user.name,
      email: user.email,
    });

    await setSessionCookie(token);

    await writeAudit({
      userId: user.id,
      action: "USER_REGISTERED",
      entityType: "USER",
      entityId: user.id,
      metadata: { email: user.email },
    });

    return jsonSuccess({ user }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
