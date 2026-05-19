import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Authenticated user session, sealed inside an httpOnly cookie.
 *
 * Tokens are AES-256-GCM encrypted with a key derived from SESSION_SECRET,
 * so the cookie is opaque to anyone without the server secret. The cookie
 * is httpOnly so client JS can't read it under any circumstance.
 */
export type Session = {
  accessToken: string;
  refreshToken?: string;
  /** UNIX ms when accessToken expires. */
  expiresAt: number;
  /** OpenID id_token, if returned. */
  idToken?: string;
};

export type PendingAuth = {
  state: string;
  codeVerifier: string;
  /** Where to redirect the user after a successful sign-in (defaults to /). */
  returnTo?: string;
};

const SESSION_COOKIE = "ayat_session";
const PENDING_COOKIE = "ayat_pending_auth";

const SECRET = process.env.SESSION_SECRET;
let key: Buffer | null = null;

function getKey(): Buffer {
  if (key) return key;
  if (!SECRET) throw new Error("SESSION_SECRET is not configured");
  key = scryptSync(SECRET, "ayat-session-v1", 32);
  return key;
}

export function seal<T>(payload: T): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, enc, tag].map((b) => b.toString("base64url")).join(".");
}

export function unseal<T>(sealed: string): T | null {
  try {
    const [ivB, encB, tagB] = sealed.split(".").map((s) => Buffer.from(s, "base64url"));
    if (!ivB || !encB || !tagB) return null;
    const decipher = createDecipheriv("aes-256-gcm", getKey(), ivB);
    decipher.setAuthTag(tagB);
    const plain = Buffer.concat([decipher.update(encB), decipher.final()]).toString("utf8");
    return JSON.parse(plain) as T;
  } catch {
    return null;
  }
}

const isProd = process.env.NODE_ENV === "production";
const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProd,
  path: "/",
};

/* ---------------------------- main session --------------------------- */

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return unseal<Session>(raw);
}

export async function setSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, seal(session), {
    ...baseCookieOptions,
    // Keep the cookie alive a bit longer than the access token so refresh
    // logic can run when the user returns.
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/* ----------------- short-lived pending PKCE/state cookie ----------- */

export async function setPendingAuth(p: PendingAuth): Promise<void> {
  const jar = await cookies();
  jar.set(PENDING_COOKIE, seal(p), {
    ...baseCookieOptions,
    maxAge: 60 * 10, // 10 minutes — only needs to outlive a login round-trip.
  });
}

export async function consumePendingAuth(): Promise<PendingAuth | null> {
  const jar = await cookies();
  const raw = jar.get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  jar.delete(PENDING_COOKIE);
  return unseal<PendingAuth>(raw);
}

export { SESSION_COOKIE };
