// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limiter";

describe("Authentication & Session Security (Unit Tests)", () => {
  describe("Password Hashing", () => {
    it("hashes password with strong salt and verifies correctly", async () => {
      const password = "SuperSecretPassword123!";
      const hashed = await hashPassword(password);

      expect(hashed).not.toBe(password);
      expect(hashed.startsWith("$2")).toBe(true);

      const isValid = await verifyPassword(password, hashed);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword("WrongPassword123!", hashed);
      expect(isInvalid).toBe(false);
    });
  });

  describe("Session JWT Tokens", () => {
    it("creates a signed JWT and verifies its payload securely", async () => {
      const user = {
        id: "usr_12345",
        email: "test@continuityx.demo",
        name: "Test User",
      };

      const token = await createSessionToken(user);
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);

      const payload = await verifySessionToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.id).toBe(user.id);
      expect(payload?.email).toBe(user.email);
      expect(payload?.name).toBe(user.name);
    });

    it("rejects tampered or forged JWT tokens", async () => {
      const fakeToken = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InVzcl8xIn0.invalidsignature";
      const payload = await verifySessionToken(fakeToken);
      expect(payload).toBeNull();
    });
  });

  describe("Login Rate Limiter", () => {
    beforeEach(() => {
      resetRateLimit("test-ip");
    });

    it("allows attempts up to maximum and blocks thereafter", () => {
      const id = "test-ip";
      const max = 3;

      expect(checkRateLimit(id, max, 5000).allowed).toBe(true);
      expect(checkRateLimit(id, max, 5000).allowed).toBe(true);
      expect(checkRateLimit(id, max, 5000).allowed).toBe(true);

      // 4th attempt exceeds max 3
      const blocked = checkRateLimit(id, max, 5000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetInSeconds).toBeGreaterThan(0);
    });
  });
});
