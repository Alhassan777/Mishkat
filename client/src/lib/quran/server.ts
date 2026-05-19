import "server-only";

import { createServerClient, type ServerClient } from "@quranjs/api/server";

/**
 * Singleton Quran.com server client.
 *
 * Returns null when QURAN_CLIENT_ID / QURAN_CLIENT_SECRET are absent so the
 * route handlers can degrade gracefully and the UI can show a "credentials
 * missing" affordance instead of crashing.
 */
let cached: ServerClient | null | undefined;

export function getQuranClient(): ServerClient | null {
  if (cached !== undefined) return cached;
  const clientId = process.env.QURAN_CLIENT_ID?.trim();
  const clientSecret = process.env.QURAN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    cached = null;
    return null;
  }
  cached = createServerClient({ clientId, clientSecret });
  return cached;
}

export function quranAvailable(): boolean {
  return getQuranClient() !== null;
}
