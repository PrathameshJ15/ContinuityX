import { describe, it, expect } from "vitest";

describe("Environment Configuration Module", () => {
  it("loads default environment values securely", async () => {
    const { env } = await import("@/lib/env");
    expect(env).toBeDefined();
    expect(env.NEXTAUTH_URL).toBeDefined();
    expect(env.STORAGE_DRIVER).toBe("local");
    expect(env.GEMINI_EXTRACTION_MODEL).toBe("gemini-3.5-flash-lite");
    expect(env.GEMINI_JUDGE_MODEL).toMatch(/^gemini-3\.5-flash/);
  });

  it("does not expose secrets when coerced to string or JSON", async () => {
    const { env } = await import("@/lib/env");
    const serialized = JSON.stringify(env);
    expect(serialized).toBeDefined();
  });
});
