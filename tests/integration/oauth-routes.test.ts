// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as googleInitRoute } from "@/app/api/auth/oauth/google/route";
import { GET as githubInitRoute } from "@/app/api/auth/oauth/github/route";
import { GET as googleCallbackRoute } from "@/app/api/auth/callback/google/route";
import { GET as githubCallbackRoute } from "@/app/api/auth/callback/github/route";
import * as oauthLib from "@/lib/oauth";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

vi.mock("@/lib/oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof oauthLib>();
  return {
    ...actual,
    exchangeGoogleCode: vi.fn(),
    exchangeGitHubCode: vi.fn(),
    handleOAuthUser: vi.fn(),
  };
});

describe("OAuth HTTP Endpoints & Lifecycle (Integration Tests)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe("Google OAuth Initiation Route (/api/auth/oauth/google)", () => {
    it("redirects to login with descriptive error if Google OAuth credentials are not set", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const req = new NextRequest("http://localhost:3000/api/auth/oauth/google");
      const res = await googleInitRoute(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(location).toContain("/login?error=");
      expect(decodeURIComponent(location.replace(/\+/g, " "))).toContain("Google OAuth is not configured");
    });

    it("redirects to Google accounts authorization URL with state when configured", async () => {
      process.env.GOOGLE_CLIENT_ID = "mock-google-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "mock-google-client-secret";

      const req = new NextRequest("http://localhost:3000/api/auth/oauth/google?returnTo=/projects/p1");
      const res = await googleInitRoute(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(location).toContain("client_id=mock-google-client-id");
      expect(location).toContain("scope=openid+email+profile");
      expect(location).toContain("state=");

      // Verify state cookie was set with httpOnly security
      const stateCookie = res.cookies.get(oauthLib.OAUTH_STATE_COOKIE_NAME);
      expect(stateCookie).toBeDefined();
      expect(stateCookie?.value.length).toBeGreaterThan(10);
      expect(stateCookie?.httpOnly).toBe(true);
    });
  });

  describe("GitHub OAuth Initiation Route (/api/auth/oauth/github)", () => {
    it("redirects to login with descriptive error if GitHub OAuth credentials are not set", async () => {
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;

      const req = new NextRequest("http://localhost:3000/api/auth/oauth/github");
      const res = await githubInitRoute(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(location).toContain("/login?error=");
      expect(decodeURIComponent(location.replace(/\+/g, " "))).toContain("GitHub OAuth is not configured");
    });

    it("redirects to GitHub authorize URL with state when configured", async () => {
      process.env.GITHUB_CLIENT_ID = "mock-github-client-id";
      process.env.GITHUB_CLIENT_SECRET = "mock-github-client-secret";

      const req = new NextRequest("http://localhost:3000/api/auth/oauth/github?returnTo=/dashboard");
      const res = await githubInitRoute(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(location).toContain("https://github.com/login/oauth/authorize");
      expect(location).toContain("client_id=mock-github-client-id");
      expect(location).toContain("scope=read%3Auser+user%3Aemail");

      const stateCookie = res.cookies.get(oauthLib.OAUTH_STATE_COOKIE_NAME);
      expect(stateCookie).toBeDefined();
      expect(stateCookie?.value.length).toBeGreaterThan(10);
      expect(stateCookie?.httpOnly).toBe(true);
    });
  });

  describe("OAuth Callback Error Handling", () => {
    it("redirects to login when user cancels authorization (error=access_denied)", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/auth/callback/google?error=access_denied"
      );
      const res = await googleCallbackRoute(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(location).toContain("/login?error=");
      expect(decodeURIComponent(location.replace(/\+/g, " "))).toContain("Google sign-in was cancelled");
    });

    it("rejects callback request missing code or state parameter", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/callback/google");
      const res = await googleCallbackRoute(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(decodeURIComponent(location.replace(/\+/g, " "))).toContain(
        "Missing authorization code or state"
      );
    });

    it("rejects callback request with mismatched or tampered state cookie", async () => {
      process.env.GOOGLE_CLIENT_ID = "valid-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "valid-client-secret";

      const { stateToken } = await oauthLib.createOAuthStateToken("google", "/dashboard");

      const req = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=valid-code&state=${stateToken}`,
        {
          headers: {
            cookie: `${oauthLib.OAUTH_STATE_COOKIE_NAME}=wrong-tampered-nonce`,
          },
        }
      );

      const res = await googleCallbackRoute(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(decodeURIComponent(location.replace(/\+/g, " "))).toContain(
        "Invalid or expired OAuth session"
      );
    });

    it("redirects to login with descriptive error when user profile email is unverified", async () => {
      process.env.GOOGLE_CLIENT_ID = "valid-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "valid-client-secret";

      const { stateToken, nonce } = await oauthLib.createOAuthStateToken("google", "/dashboard");

      vi.mocked(oauthLib.exchangeGoogleCode).mockResolvedValueOnce({
        provider: "google",
        providerId: "google-unverified",
        email: "unverified@example.com",
        emailVerified: false,
        name: "Unverified Person",
      });

      vi.mocked(oauthLib.handleOAuthUser).mockRejectedValueOnce(
        new Error("Email is not verified by Google. Unverified accounts cannot be linked or authenticated.")
      );

      const req = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=valid-code&state=${stateToken}`,
        {
          headers: {
            cookie: `${oauthLib.OAUTH_STATE_COOKIE_NAME}=${nonce}`,
          },
        }
      );

      const res = await googleCallbackRoute(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(decodeURIComponent(location.replace(/\+/g, " "))).toContain(
        "Email is not verified by Google"
      );
    });
  });

  describe("Google Callback Success Flows", () => {
    it("authenticates an existing user and redirects to destination upon valid state and code exchange", async () => {
      process.env.GOOGLE_CLIENT_ID = "valid-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "valid-client-secret";

      const { stateToken, nonce } = await oauthLib.createOAuthStateToken(
        "google",
        "/projects/attendance-project"
      );

      vi.mocked(oauthLib.exchangeGoogleCode).mockResolvedValueOnce({
        provider: "google",
        providerId: "google-12345",
        email: "verified@example.com",
        emailVerified: true,
        name: "Verified User",
      });

      vi.mocked(oauthLib.handleOAuthUser).mockResolvedValueOnce({
        user: { id: "usr-verified", email: "verified@example.com", name: "Verified User" },
        isNewUser: false,
      });

      const req = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=valid-auth-code&state=${stateToken}`,
        {
          headers: {
            cookie: `${oauthLib.OAUTH_STATE_COOKIE_NAME}=${nonce}`,
          },
        }
      );

      const res = await googleCallbackRoute(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(location).toContain("/projects/attendance-project");

      const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME);
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.value.length).toBeGreaterThan(20);
      expect(sessionCookie?.httpOnly).toBe(true);
    });

    it("registers a brand-new user via Google OAuth, establishes session, and redirects to dashboard", async () => {
      process.env.GOOGLE_CLIENT_ID = "valid-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "valid-client-secret";

      const { stateToken, nonce } = await oauthLib.createOAuthStateToken("google", "/dashboard");

      vi.mocked(oauthLib.exchangeGoogleCode).mockResolvedValueOnce({
        provider: "google",
        providerId: "google-9999",
        email: "newuser@example.com",
        emailVerified: true,
        name: "Brand New Google User",
      });

      vi.mocked(oauthLib.handleOAuthUser).mockResolvedValueOnce({
        user: { id: "usr-new-google", email: "newuser@example.com", name: "Brand New Google User" },
        isNewUser: true,
      });

      const req = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=valid-code&state=${stateToken}`,
        {
          headers: {
            cookie: `${oauthLib.OAUTH_STATE_COOKIE_NAME}=${nonce}`,
          },
        }
      );

      const res = await googleCallbackRoute(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(location).toContain("/dashboard");

      const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME);
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.httpOnly).toBe(true);
    });
  });

  describe("GitHub Callback Success Flow", () => {
    it("authenticates user and redirects to destination upon valid state and code exchange", async () => {
      process.env.GITHUB_CLIENT_ID = "valid-github-id";
      process.env.GITHUB_CLIENT_SECRET = "valid-github-secret";

      const { stateToken, nonce } = await oauthLib.createOAuthStateToken("github", "/dashboard");

      vi.mocked(oauthLib.exchangeGitHubCode).mockResolvedValueOnce({
        provider: "github",
        providerId: "github-8877",
        email: "github.dev@example.com",
        emailVerified: true,
        name: "Dev GitHubber",
      });

      vi.mocked(oauthLib.handleOAuthUser).mockResolvedValueOnce({
        user: { id: "usr-gh-1", email: "github.dev@example.com", name: "Dev GitHubber" },
        isNewUser: true,
      });

      const req = new NextRequest(
        `http://localhost:3000/api/auth/callback/github?code=valid-gh-code&state=${stateToken}`,
        {
          headers: {
            cookie: `${oauthLib.OAUTH_STATE_COOKIE_NAME}=${nonce}`,
          },
        }
      );

      const res = await githubCallbackRoute(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location") || "";
      expect(location).toContain("/dashboard");

      const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME);
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.value.length).toBeGreaterThan(20);
      expect(sessionCookie?.httpOnly).toBe(true);
    });
  });
});
