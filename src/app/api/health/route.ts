import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "connected";
  let dbLatencyMs: number | null = null;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (error) {
    dbStatus = "disconnected";
    // Never expose database credentials, hostnames, or raw error messages
    const rawMsg = error instanceof Error ? error.message : "Unknown error";
    const sanitizedMsg = rawMsg
      .replace(/password\s*=\s*[^\s;]+/gi, "password=[REDACTED]")
      .replace(/postgres(ql)?:\/\/[^@]+@/gi, "postgresql://[REDACTED]@")
      .replace(/[A-Za-z]:\\[^\s]+/g, "[path]");
    console.error("[HealthCheck] Database connection check failed:", sanitizedMsg);
  }

  const responseTimeMs = Date.now() - startTime;
  const isHealthy = dbStatus === "connected";

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: "0.1.0-phase0",
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
      },
      responseTimeMs,
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
