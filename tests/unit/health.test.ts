import { describe, it, expect, vi } from "vitest";
import { GET } from "@/app/api/health/route";

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe("GET /api/health", () => {
  it("returns healthy status and 200 when database responds", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([1]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.services.database.status).toBe("connected");
    expect(typeof data.responseTimeMs).toBe("number");
  });

  it("returns degraded status and 503 without leaking secrets when database fails", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(
      new Error("connection timeout to secret-host:5432 with password secret-pwd")
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.services.database.status).toBe("disconnected");
    // Ensure no secret database connection string is exposed in JSON response
    expect(JSON.stringify(data)).not.toContain("secret-pwd");
    expect(JSON.stringify(data)).not.toContain("secret-host");
  });
});
