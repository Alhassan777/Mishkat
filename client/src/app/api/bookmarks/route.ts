import { NextResponse } from "next/server";
import { callUserApi } from "@/lib/quran/user-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/bookmarks → list the signed-in user's saved āyāt.
 * POST /api/bookmarks { verseKey: "2:255" } → save an āyah.
 *
 * We normalize the upstream's shape into { id, verseKey } pairs the UI
 * can use directly. QF returns timestamps + nested verse data we don't
 * need at this layer.
 */
export async function GET() {
  const r = await callUserApi("/auth/v1/bookmarks");
  if (r.kind === "unauthorized") {
    return NextResponse.json({ signedIn: false, bookmarks: [] }, { status: 401 });
  }
  const res = r.response;
  if (!res.ok) {
    return NextResponse.json(
      { signedIn: true, error: `Upstream ${res.status}` },
      { status: 502 },
    );
  }
  const json = (await res.json()) as unknown;
  return NextResponse.json({ signedIn: true, bookmarks: normalize(json) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { verseKey?: string };
  const verseKey = body.verseKey;
  if (!verseKey || !/^\d{1,3}:\d{1,3}$/.test(verseKey)) {
    return NextResponse.json({ error: "verseKey required, e.g. '2:255'" }, { status: 400 });
  }

  const r = await callUserApi("/auth/v1/bookmarks", {
    method: "POST",
    body: JSON.stringify({ key: verseKey, mushaf_id: 2, type: "ayah" }),
  });
  if (r.kind === "unauthorized") {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const res = r.response;
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Upstream ${res.status}: ${text.slice(0, 200)}` },
      { status: 502 },
    );
  }
  const json = (await res.json().catch(() => ({}))) as unknown;
  return NextResponse.json({ ok: true, bookmark: normalizeOne(json) });
}

/* ---------------------- shape normalization ---------------------- */

type Normalized = { id: string; verseKey: string };

function pickVerseKey(o: Record<string, unknown>): string | undefined {
  if (typeof o.key === "string") return o.key;
  if (typeof o.verse_key === "string") return o.verse_key;
  if (typeof o.verseKey === "string") return o.verseKey;
  const v = o.verse as Record<string, unknown> | undefined;
  if (v && typeof v.verse_key === "string") return v.verse_key;
  return undefined;
}

function pickId(o: Record<string, unknown>): string | undefined {
  if (typeof o.id === "string") return o.id;
  if (typeof o.id === "number") return String(o.id);
  return undefined;
}

function normalizeOne(input: unknown): Normalized | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  // Sometimes wrapped in { bookmark: {...} } or { data: {...} }.
  const inner = (o.bookmark ?? o.data ?? o) as Record<string, unknown>;
  const id = pickId(inner);
  const verseKey = pickVerseKey(inner);
  return id && verseKey ? { id, verseKey } : null;
}

function normalize(input: unknown): Normalized[] {
  if (!input) return [];
  // QF responses are sometimes paginated as { bookmarks: [...] } or { data: [...] }
  if (typeof input === "object" && !Array.isArray(input)) {
    const o = input as Record<string, unknown>;
    const arr = (o.bookmarks ?? o.data ?? o.items ?? []) as unknown;
    if (Array.isArray(arr)) return arr.map(normalizeOne).filter(Boolean) as Normalized[];
  }
  if (Array.isArray(input)) return input.map(normalizeOne).filter(Boolean) as Normalized[];
  return [];
}
