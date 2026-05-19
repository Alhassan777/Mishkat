import { NextResponse } from "next/server";
import { exchangeCodeForTokens, getOAuthConfig, toSession } from "@/lib/quran/oauth";
import { consumePendingAuth, setSession } from "@/lib/session";

/**
 * GET /callback?code=...&state=...
 *
 * Lives at the top-level path because that's the redirect URI Quran
 * Foundation's pre-live client has pre-registered by default
 * (per the QF starter app / web-integration docs). Don't move this to
 * /api/auth/callback without first emailing developers@quran.com to
 * register the new URI.
 *
 * Validates the state cookie, exchanges the auth code for tokens, seals
 * them into the long-lived session cookie, and bounces the user back
 * wherever they came from.
 */
export async function GET(req: Request) {
  if (!getOAuthConfig()) {
    return NextResponse.redirect(new URL("/?auth_error=not_configured", req.url));
  }
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(errorParam)}`, req.url),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/?auth_error=missing_code", req.url));
  }

  const pending = await consumePendingAuth();
  if (!pending || pending.state !== state) {
    return NextResponse.redirect(new URL("/?auth_error=bad_state", req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code, pending.codeVerifier);
    await setSession(toSession(tokens));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("OAuth exchange failed:", msg);
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent("exchange_failed")}`, req.url),
    );
  }

  return NextResponse.redirect(new URL(pending.returnTo || "/", req.url));
}
