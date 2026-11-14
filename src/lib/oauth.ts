import fs from "fs";
import path from "path";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { hashPassword, getSecretKey } from "@/lib/auth";
import { AuthenticatedUser } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

export const OAUTH_STATE_COOKIE_NAME = "continuityx_oauth_state";
export const OAUTH_STATE_MAX_AGE = 600; // 10 minutes in seconds

/**
 * Resolves an OAuth credential safely, checking process.env first,
 * with fallback to reading .env.local dynamically on the server.
 */
export function getOAuthCredential(key: string): string | undefined {
  if (process.env.NODE_ENV === "test") {
    return process.env[key];
  }
  if (process.env[key]) {
    return process.env[key];
  }
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(new RegExp(`^${key}\\s*=\\s*["']?([^"'\\r\\n]+)["']?`, "m"));
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch {
    // Graceful fallback
  }
  return undefined;
}

export type OAuthProvider = "google" | "github";

export interface OAuthUserProfile {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export interface OAuthStatePayload {
  provider: OAuthProvider;
  nonce: string;
  returnTo: string;
  timestamp: number;
}

/**
 * Creates a signed CSRF state token with an embedded nonce and return URL.
 */
export async function createOAuthStateToken(
  provider: OAuthProvider,
  returnTo: string = "/dashboard"
): Promise<{ stateToken: string; nonce: string }> {
  const nonce = crypto.randomUUID();
  const secret = getSecretKey();
  const sanitizedReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";

  const stateToken = await new SignJWT({
    provider,
    nonce,
    returnTo: sanitizedReturn,
    timestamp: Date.now(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);

  return { stateToken, nonce };
}

/**
 * Cryptographically verifies that the state token was signed by our server,
 * has not expired, and matches the expected OAuth provider.
 */
export async function verifyOAuthStateToken(
  stateToken: string,
  expectedProvider: OAuthProvider
): Promise<OAuthStatePayload | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(stateToken, secret, {
      algorithms: ["HS256"],
    });

    if (
      payload.provider === expectedProvider &&
      typeof payload.nonce === "string" &&
      typeof payload.returnTo === "string"
    ) {
      return {
        provider: payload.provider as OAuthProvider,
        nonce: payload.nonce,
        returnTo: payload.returnTo,
        timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves the canonical OAuth redirect URI for a provider.
 * Respects NEXTAUTH_URL in production/custom environments to guarantee
 * identical URI between authorization and token-exchange phases.
 */
export function getOAuthRedirectUri(requestOrigin: string, provider: OAuthProvider): string {
  const configuredUrl = process.env.NEXTAUTH_URL;
  let baseOrigin = requestOrigin;

  if (configuredUrl) {
    try {
      baseOrigin = new URL(configuredUrl).origin;
    } catch {
      // Fallback to request origin if NEXTAUTH_URL is malformed
    }
  }

  return `${baseOrigin}/api/auth/callback/${provider}`;
}

/**
 * Generates the official Google OAuth 2.0 authorization URL.
 */
export function getGoogleAuthUrl(state: string, redirectUri: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Generates the official GitHub OAuth authorization URL.
 */
export function getGitHubAuthUrl(state: string, redirectUri: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchanges the Google authorization code for an access token and fetches the verified user profile.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthUserProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${errorText}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    throw new Error("Missing access_token in Google OAuth response");
  }

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    throw new Error(`Google userinfo fetch failed (${userRes.status})`);
  }

  const userData = await userRes.json();
  const email = (userData.email || "").trim().toLowerCase();
  const emailVerified = Boolean(userData.email_verified);

  if (!email) {
    throw new Error("Google account did not provide an email address.");
  }

  return {
    provider: "google",
    providerId: String(userData.sub || ""),
    email,
    emailVerified,
    name: userData.name?.trim() || userData.given_name || email.split("@")[0],
  };
}

/**
 * Exchanges the GitHub authorization code for an access token and fetches the verified primary email.
 */
export async function exchangeGitHubCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthUserProfile> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    throw new Error(`GitHub token exchange failed (${tokenRes.status}): ${errorText}`);
  }

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    throw new Error(`GitHub token error: ${tokenData.error_description || tokenData.error}`);
  }

  const accessToken = tokenData.access_token;
  if (!accessToken) {
    throw new Error("Missing access_token in GitHub OAuth response");
  }

  // 1. Fetch user profile
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "ContinuityX-Platform",
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!userRes.ok) {
    throw new Error(`GitHub user profile fetch failed (${userRes.status})`);
  }

  const userData = await userRes.json();

  // 2. Fetch user verified emails
  const emailsRes = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "ContinuityX-Platform",
      Accept: "application/vnd.github.v3+json",
    },
  });

  let primaryEmail = "";
  let emailVerified = false;

  if (emailsRes.ok) {
    const emailsList: Array<{ email: string; primary: boolean; verified: boolean }> =
      await emailsRes.json();

    const primary = emailsList.find((e) => e.primary && e.verified);
    if (primary) {
      primaryEmail = primary.email;
      emailVerified = true;
    } else {
      const anyVerified = emailsList.find((e) => e.verified);
      if (anyVerified) {
        primaryEmail = anyVerified.email;
        emailVerified = true;
      }
    }
  } else if (userData.email) {
    primaryEmail = userData.email;
    emailVerified = false;
  }

  const email = primaryEmail.trim().toLowerCase();

  return {
    provider: "github",
    providerId: String(userData.id),
    email,
    emailVerified,
    name: userData.name?.trim() || userData.login || email.split("@")[0] || "GitHub User",
  };
}

/**
 * Handles account-linking and new user registration for verified OAuth identities.
 * Strictly requires emailVerified === true to prevent malicious unverified account takeover.
 */
export async function handleOAuthUser(profile: OAuthUserProfile): Promise<{
  user: AuthenticatedUser;
  isNewUser: boolean;
}> {
  if (!profile.email || !profile.emailVerified) {
    throw new Error(
      `Email is not verified by ${profile.provider === "google" ? "Google" : "GitHub"}. Unverified accounts cannot be linked or authenticated.`
    );
  }

  const normalizedEmail = profile.email.toLowerCase();

  // 1. Check if user already exists in the system
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true, email: true },
  });

  if (existingUser) {
    await writeAudit({
      userId: existingUser.id,
      action: "OAUTH_LOGIN_SUCCESS",
      entityType: "AUTH",
      entityId: existingUser.id,
      metadata: {
        provider: profile.provider,
        providerId: profile.providerId,
        email: normalizedEmail,
        accountLinked: true,
      },
    });

    return {
      user: existingUser,
      isNewUser: false,
    };
  }

  // 2. Create new user with locked random password (cannot be guessed or authenticated via password)
  const lockedRandomPassword = `oauth_locked_${profile.provider}_${crypto.randomUUID()}`;
  const passwordHash = await hashPassword(lockedRandomPassword);

  const newUser = await prisma.user.create({
    data: {
      name: profile.name.trim() || normalizedEmail.split("@")[0],
      email: normalizedEmail,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  await writeAudit({
    userId: newUser.id,
    action: "USER_REGISTERED_OAUTH",
    entityType: "USER",
    entityId: newUser.id,
    metadata: {
      provider: profile.provider,
      providerId: profile.providerId,
      email: normalizedEmail,
    },
  });

  await writeAudit({
    userId: newUser.id,
    action: "OAUTH_LOGIN_SUCCESS",
    entityType: "AUTH",
    entityId: newUser.id,
    metadata: {
      provider: profile.provider,
      providerId: profile.providerId,
      email: normalizedEmail,
      accountLinked: false,
    },
  });

  return {
    user: newUser,
    isNewUser: true,
  };
}
