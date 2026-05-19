import { NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  generatePkce,
  generateState,
  getOAuthConfig,
} from "@/lib/quran/oauth";
import { setPendingAuth } from "@/lib/session";

/**
 * GET /api/auth/login?returnTo=/some/path
 *
 * Begins the OAuth flow: mints PKCE + state, stashes both in a short-lived
 * sealed cookie, then redirects the browser to Quran.Foundation's hosted
 * login. The callback route reads the cookie back to validate state and
 * complete the token exchange.
 */
export async function GET(req: Request) {
  if (!getOAuthConfig()) {
    return NextResponse.json(
      { error: "Sign-in is not configured (missing QF_USER_* env vars)." },
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") ?? "/";

  const { codeVerifier, codeChallenge } = generatePkce();
  const state = generateState();
  await setPendingAuth({ state, codeVerifier, returnTo });

  const authorizeUrl = buildAuthorizeUrl(codeChallenge, state);
  if (!authorizeUrl) {
    return NextResponse.json({ error: "Failed to build authorize URL" }, { status: 500 });
  }
  return NextResponse.redirect(authorizeUrl);
}
