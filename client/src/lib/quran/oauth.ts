import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Hand-rolled OAuth2 Authorization-Code-with-PKCE helpers, scoped to
 * Quran.Foundation's pre-live / production endpoints. We bypass the SDK
 * for the OAuth handshake because the SDK is designed around an already-
 * authenticated user session, not the initial code exchange.
 */

// `collection` is needed alongside `bookmark` for the collection-scoped
// endpoints (e.g. removing a verse from the default Favorites collection).
const SCOPES = ["openid", "offline_access", "bookmark", "collection"];

export function getOAuthConfig() {
  const base = process.env.QF_USER_OAUTH_BASE;
  const clientId = process.env.QF_USER_CLIENT_ID;
  const clientSecret = process.env.QF_USER_CLIENT_SECRET;
  const redirectUri = process.env.QF_USER_REDIRECT_URI;
  if (!base || !clientId || !clientSecret || !redirectUri) return null;
  return { base, clientId, clientSecret, redirectUri };
}

export function generatePkce() {
  // RFC 7636: code_verifier is high-entropy URL-safe string, 43–128 chars.
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function generateState(): string {
  return randomBytes(16).toString("base64url");
}

export function buildAuthorizeUrl(codeChallenge: string, state: string): string | null {
  const cfg = getOAuthConfig();
  if (!cfg) return null;
  const url = new URL("/oauth2/auth", cfg.base);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  // Force the IdP to show its login form even if it still has a session
  // for the user. Without this, signing out clears our local cookie but
  // the next "Sign in" click silently re-authenticates via QF's session.
  url.searchParams.set("prompt", "login");
  return url.toString();
}

export type TokenSet = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  id_token?: string;
};

async function postTokenRequest(body: URLSearchParams): Promise<TokenSet> {
  const cfg = getOAuthConfig();
  if (!cfg) throw new Error("OAuth not configured");
  const credentials = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const r = await fetch(new URL("/oauth2/token", cfg.base), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${credentials}`,
      accept: "application/json",
    },
    body,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Token endpoint returned ${r.status}: ${text.slice(0, 400)}`);
  }
  return (await r.json()) as TokenSet;
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenSet> {
  const cfg = getOAuthConfig();
  if (!cfg) throw new Error("OAuth not configured");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    code_verifier: codeVerifier,
  });
  return postTokenRequest(body);
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const cfg = getOAuthConfig();
  if (!cfg) throw new Error("OAuth not configured");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: cfg.clientId,
  });
  return postTokenRequest(body);
}

/** Convert a TokenSet (server time delta) into our Session shape. */
export function toSession(t: TokenSet) {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + Math.max(0, t.expires_in - 30) * 1000, // 30s slack
    idToken: t.id_token,
  };
}
