import { NextRequest, NextResponse } from "next/server";
import {
  createOAuthStateToken,
  getGoogleAuthUrl,
  getOAuthRedirectUri,
  getOAuthCredential,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_MAX_AGE,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = getOAuthCredential("GOOGLE_CLIENT_ID");
  const clientSecret = getOAuthCredential("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    const errorMsg = encodeURIComponent(
      "Google OAuth is not configured on the server. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local."
    );
    return NextResponse.redirect(new URL(`/login?error=${errorMsg}`, req.url));
  }

  const returnTo = req.nextUrl.searchParams.get("returnTo") || "/dashboard";
  const { stateToken, nonce } = await createOAuthStateToken("google", returnTo);

  const redirectUri = getOAuthRedirectUri(req.nextUrl.origin, "google");
  const authUrl = getGoogleAuthUrl(stateToken, redirectUri, clientId);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(OAUTH_STATE_COOKIE_NAME, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });

  return res;
}
