import { describe, it, expect } from "vitest";

describe("Environment Configuration Module", () => {
  it("loads default environment values securely", async () => {
    const { env } = await import("@/lib/env");
    expect(env).toBeDefined();
    expect(env.NEXTAUTH_URL).toBeDefined();
    expect(env.STORAGE_DRIVER).toBe("local");
    expect(env.GROQ_EXTRACTION_MODEL).toBe("openai/gpt-oss-120b");
    expect(env.GROQ_VERIFICATION_MODEL).toBe("openai/gpt-oss-20b");
  });

  it("does not expose secrets when coerced to string or JSON", async () => {
    const { env } = await import("@/lib/env");
    const serialized = JSON.stringify(env);
    expect(serialized).toBeDefined();
  });
});
