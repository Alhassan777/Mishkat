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
  // QF requires `mushafId`, `type`, and one of `first`/`last`; the endpoint
  // is cursor-paginated with a max page size of 20, so we loop until done.
  const all: Normalized[] = [];
  let after: string | undefined;
  for (let page = 0; page < 25; page++) {
    const r = await callUserApi("/auth/v1/bookmarks", {
      searchParams: { mushafId: 2, type: "ayah", first: 20, after },
    });
    if (r.kind === "unauthorized") {
      return NextResponse.json({ signedIn: false, bookmarks: [] }, { status: 401 });
    }
    const res = r.response;
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { signedIn: true, error: `Upstream ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const json = (await res.json()) as Record<string, unknown>;
    all.push(...normalize(json));
    const pagination = json.pagination as
      | { hasNextPage?: boolean; endCursor?: string }
      | undefined;
    if (!pagination?.hasNextPage || !pagination.endCursor) break;
    after = pagination.endCursor;
  }
  return NextResponse.json({ signedIn: true, bookmarks: all });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { verseKey?: string };
  const verseKey = body.verseKey;
  const match = verseKey?.match(/^(\d{1,3}):(\d{1,3})$/);
  if (!verseKey || !match) {
    return NextResponse.json({ error: "verseKey required, e.g. '2:255'" }, { status: 400 });
  }
  const surah = Number(match[1]);
  const verseNumber = Number(match[2]);

  const r = await callUserApi("/auth/v1/bookmarks", {
    method: "POST",
    body: JSON.stringify({ key: surah, verseNumber, type: "ayah", mushaf: 2 }),
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
  if (typeof o.key === "string" && o.key.includes(":")) return o.key;
  if (typeof o.verse_key === "string") return o.verse_key;
  if (typeof o.verseKey === "string") return o.verseKey;
  const v = o.verse as Record<string, unknown> | undefined;
  if (v && typeof v.verse_key === "string") return v.verse_key;
  // QF user-API shape: { key: <surah:int>, verseNumber: <int>, type: "ayah" }
  const surah = typeof o.key === "number" ? o.key : Number(o.key);
  const ayah = typeof o.verseNumber === "number" ? o.verseNumber : Number(o.verseNumber);
  if (Number.isFinite(surah) && Number.isFinite(ayah) && surah > 0 && ayah > 0) {
    return `${surah}:${ayah}`;
  }
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
