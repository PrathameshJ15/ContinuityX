import { NextRequest, NextResponse } from "next/server";
import {
  verifyOAuthStateToken,
  exchangeGoogleCode,
  handleOAuthUser,
  getOAuthRedirectUri,
  getOAuthCredential,
  OAUTH_STATE_COOKIE_NAME,
} from "@/lib/oauth";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // 1. Handle user cancellation or OAuth error
  if (error) {
    const errorMsg =
      error === "access_denied"
        ? "Google sign-in was cancelled."
        : errorDescription || error || "Google authentication was declined.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, req.url));
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/login?error=Invalid+OAuth+response.+Missing+authorization+code+or+state.", req.url)
    );
  }

  // 2. Validate CSRF state token and cookie
  const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  const statePayload = await verifyOAuthStateToken(state, "google");

  if (!statePayload || !stateCookie || statePayload.nonce !== stateCookie) {
    return NextResponse.redirect(
      new URL("/login?error=Invalid+or+expired+OAuth+session.+Please+try+again.", req.url)
    );
  }

  // 3. Check server configuration
  const clientId = getOAuthCredential("GOOGLE_CLIENT_ID");
  const clientSecret = getOAuthCredential("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login?error=Google+OAuth+credentials+are+not+configured+on+the+server.", req.url)
    );
  }

  try {
    const redirectUri = getOAuthRedirectUri(req.nextUrl.origin, "google");
    const profile = await exchangeGoogleCode(code, redirectUri, clientId, clientSecret);
    const { user } = await handleOAuthUser(profile);

    // 4. Issue authenticated session
    const sessionToken = await createSessionToken(user);

    const targetUrl =
      statePayload.returnTo.startsWith("/") && !statePayload.returnTo.startsWith("//")
        ? statePayload.returnTo
        : "/dashboard";

    const res = NextResponse.redirect(new URL(targetUrl, req.url));

    res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    // 5. Clean up state cookie
    res.cookies.delete(OAUTH_STATE_COOKIE_NAME);

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to sign in with Google.";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, req.url));
  }
}
