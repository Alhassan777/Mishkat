import "server-only";

import { getSession, setSession, type Session } from "@/lib/session";
import { getOAuthConfig, refreshAccessToken, toSession } from "@/lib/quran/oauth";

/**
 * Resolve a valid access token for the current request, refreshing if
 * the cookie holds an expired one. Returns null when the user is signed
 * out — callers should respond 401.
 *
 * The refresh path is best-effort: if Quran.Foundation rejects the
 * refresh token (rotated / revoked) we behave as if the session were
 * gone, so the UI prompts the user to sign in again.
 */
export async function getValidSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.expiresAt > Date.now() + 5_000) return session;
  if (!session.refreshToken) return null;
  try {
    const refreshed = await refreshAccessToken(session.refreshToken);
    const next: Session = {
      ...toSession(refreshed),
      // QF doesn't always rotate the refresh_token; keep ours if absent.
      refreshToken: refreshed.refresh_token ?? session.refreshToken,
    };
    await setSession(next);
    return next;
  } catch (e) {
    console.warn("Refresh failed, clearing session:", e instanceof Error ? e.message : e);
    return null;
  }
}

export type UserApiResult =
  | { kind: "unauthorized" }
  | { kind: "response"; response: Response };

/**
 * Call any User API endpoint with the auth headers QF expects.
 * `path` should start with "/" — e.g. "/auth/v1/bookmarks".
 */
export async function callUserApi(
  path: string,
  init: RequestInit & { searchParams?: Record<string, string | number | undefined> } = {},
): Promise<UserApiResult> {
  const session = await getValidSession();
  if (!session) return { kind: "unauthorized" };

  const cfg = getOAuthConfig();
  const base = process.env.QF_USER_API_BASE;
  if (!cfg || !base) {
    throw new Error("User API not configured (missing QF_USER_API_BASE)");
  }

  const url = new URL(path, base);
  if (init.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers = new Headers(init.headers);
  headers.set("x-auth-token", session.accessToken);
  headers.set("x-client-id", cfg.clientId);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  headers.set("accept", "application/json");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { searchParams: _, ...rest } = init;
  const response = await fetch(url, { ...rest, headers });
  return { kind: "response", response };
}
