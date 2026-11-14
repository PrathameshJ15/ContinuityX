// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createOAuthStateToken,
  verifyOAuthStateToken,
  getGoogleAuthUrl,
  getGitHubAuthUrl,
  getOAuthRedirectUri,
  handleOAuthUser,
  OAuthUserProfile,
} from "@/lib/oauth";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    projectMember: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn(),
}));

describe("OAuth Core Architecture & Security (Unit Tests)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CSRF State Token Handling", () => {
    it("creates a signed JWT state token containing provider, nonce, and returnTo", async () => {
      const { stateToken, nonce } = await createOAuthStateToken("google", "/projects/proj-123");
      expect(typeof stateToken).toBe("string");
      expect(typeof nonce).toBe("string");
      expect(nonce.length).toBeGreaterThan(10);

      const verified = await verifyOAuthStateToken(stateToken, "google");
      expect(verified).not.toBeNull();
      expect(verified?.provider).toBe("google");
      expect(verified?.nonce).toBe(nonce);
      expect(verified?.returnTo).toBe("/projects/proj-123");
    });

    it("sanitizes open-redirect returnTo paths back to default /dashboard", async () => {
      const { stateToken } = await createOAuthStateToken("github", "https://attacker.evil.com");
      const verified = await verifyOAuthStateToken(stateToken, "github");
      expect(verified?.returnTo).toBe("/dashboard");
    });

    it("rejects state token if provider mismatches expected provider", async () => {
      const { stateToken } = await createOAuthStateToken("google", "/dashboard");
      const verified = await verifyOAuthStateToken(stateToken, "github");
      expect(verified).toBeNull();
    });

    it("rejects tampered or malformed state tokens", async () => {
      const verified = await verifyOAuthStateToken("invalid.jwt.token", "google");
      expect(verified).toBeNull();
    });
  });

  describe("Authorization & Redirect URL Generation", () => {
    it("generates valid Google OAuth 2.0 authorization URL with required scopes", () => {
      const url = getGoogleAuthUrl("state-123", "http://localhost:3000/callback", "google-client-id");
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://accounts.google.com");
      expect(parsed.pathname).toBe("/o/oauth2/v2/auth");
      expect(parsed.searchParams.get("client_id")).toBe("google-client-id");
      expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost:3000/callback");
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("scope")).toBe("openid email profile");
      expect(parsed.searchParams.get("state")).toBe("state-123");
    });

    it("generates valid GitHub OAuth authorization URL with required scopes", () => {
      const url = getGitHubAuthUrl("state-456", "http://localhost:3000/callback", "github-client-id");
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://github.com");
      expect(parsed.pathname).toBe("/login/oauth/authorize");
      expect(parsed.searchParams.get("client_id")).toBe("github-client-id");
      expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost:3000/callback");
      expect(parsed.searchParams.get("scope")).toBe("read:user user:email");
      expect(parsed.searchParams.get("state")).toBe("state-456");
    });

    it("resolves canonical OAuth redirect URI matching NEXTAUTH_URL when configured", () => {
      const prevUrl = process.env.NEXTAUTH_URL;
      process.env.NEXTAUTH_URL = "http://localhost:3000";

      const uri = getOAuthRedirectUri("http://127.0.0.1:3000", "google");
      expect(uri).toBe("http://localhost:3000/api/auth/callback/google");

      process.env.NEXTAUTH_URL = prevUrl;
    });
  });

  describe("handleOAuthUser Account Linking & Creation", () => {
    it("links safely to existing account when Google OAuth email is verified", async () => {
      const { prisma } = await import("@/lib/db");
      const { writeAudit } = await import("@/lib/audit");

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "usr-existing-1",
        email: "lead@continuityx.demo",
        name: "Arjun Mehta",
      } as any);

      const profile: OAuthUserProfile = {
        provider: "google",
        providerId: "google-sub-12345",
        email: "lead@continuityx.demo",
        emailVerified: true,
        name: "Arjun Mehta Google",
      };

      const result = await handleOAuthUser(profile);

      expect(result.isNewUser).toBe(false);
      expect(result.user.id).toBe("usr-existing-1");
      expect(result.user.email).toBe("lead@continuityx.demo");
      expect(prisma.user.create).not.toHaveBeenCalled();

      expect(writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "OAUTH_LOGIN_SUCCESS",
          entityId: "usr-existing-1",
          metadata: expect.objectContaining({
            provider: "google",
            accountLinked: true,
          }),
        })
      );
    });

    it("registers a new user through Google OAuth and never grants automatic project memberships or OWNER role", async () => {
      const { prisma } = await import("@/lib/db");
      const { writeAudit } = await import("@/lib/audit");

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: "usr-new-google-user",
        email: "newgoogleuser@example.com",
        name: "Google Explorer",
      } as any);

      const profile: OAuthUserProfile = {
        provider: "google",
        providerId: "google-sub-99999",
        email: "newgoogleuser@example.com",
        emailVerified: true,
        name: "Google Explorer",
      };

      const result = await handleOAuthUser(profile);

      expect(result.isNewUser).toBe(true);
      expect(result.user.id).toBe("usr-new-google-user");

      // Verify user created with locked password
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "newgoogleuser@example.com",
            name: "Google Explorer",
            passwordHash: expect.stringMatching(/^\$2[aby]\$/),
          }),
        })
      );

      // Verify no default project memberships are created automatically
      expect(writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "USER_REGISTERED_OAUTH",
          entityId: "usr-new-google-user",
        })
      );
    });

    it("strictly rejects unverified Google email addresses and never automatically links them", async () => {
      const { prisma } = await import("@/lib/db");

      const unverifiedGoogleProfile: OAuthUserProfile = {
        provider: "google",
        providerId: "google-fake-id",
        email: "victim@continuityx.demo",
        emailVerified: false, // Google reports email is not verified
        name: "Imposter",
      };

      await expect(handleOAuthUser(unverifiedGoogleProfile)).rejects.toThrow(
        /Email is not verified by Google/i
      );

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });
});
