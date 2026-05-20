"use client";

import type {
  Verse,
  TranslationResource,
  TafsirResource,
  RecitationResource,
} from "@quranjs/api";

export type QuranEnrichment = {
  /** Whether the API is reachable in this deployment. */
  available: boolean;
  reason?: string;
  verse?: Verse;
  error?: string;
};

export type QuranCatalog = {
  available: boolean;
  reason?: string;
  translations?: TranslationResource[];
  tafsirs?: TafsirResource[];
  reciters?: RecitationResource[];
  error?: string;
};

/* ------------------------------ tiny cache ------------------------------ */

const verseCache = new Map<string, Promise<QuranEnrichment>>();
const catalogCache = new Map<string, Promise<QuranCatalog>>();

export type VerseFetchOptions = {
  words?: boolean;
  translation?: string | number;
  tafsir?: string | number;
  reciter?: string | number;
};

function cacheKey(key: string, opts: VerseFetchOptions): string {
  return [
    key,
    opts.words ? "w" : "",
    opts.translation ?? "",
    opts.tafsir ?? "",
    opts.reciter ?? "",
  ].join("|");
}

export function fetchVerse(key: string, opts: VerseFetchOptions = {}): Promise<QuranEnrichment> {
  const ck = cacheKey(key, opts);
  const hit = verseCache.get(ck);
  if (hit) return hit;

  const params = new URLSearchParams();
  if (opts.words) params.set("words", "true");
  if (opts.translation !== undefined) params.set("translation", String(opts.translation));
  if (opts.tafsir !== undefined) params.set("tafsir", String(opts.tafsir));
  if (opts.reciter !== undefined) params.set("reciter", String(opts.reciter));

  const url = `/api/quran/verse/${encodeURIComponent(key)}${params.size ? `?${params}` : ""}`;
  const p: Promise<QuranEnrichment> = fetch(url)
    .then(async (r) => {
      const json = (await r.json()) as QuranEnrichment;
      if (!r.ok && r.status !== 503) {
        return { available: true, error: json.error ?? `HTTP ${r.status}` };
      }
      return json;
    })
    .catch((e) => ({ available: true, error: e instanceof Error ? e.message : String(e) }));
  verseCache.set(ck, p);
  return p;
}

export function fetchCatalog(lang: "en" | "ar" = "en"): Promise<QuranCatalog> {
  const hit = catalogCache.get(lang);
  if (hit) return hit;
  const p: Promise<QuranCatalog> = fetch(`/api/quran/resources?lang=${lang}`)
    .then(async (r) => {
      const json = (await r.json()) as QuranCatalog;
      if (!r.ok && r.status !== 503) {
        return { available: true, error: json.error ?? `HTTP ${r.status}` };
      }
      return json;
    })
    .catch((e) => ({ available: true, error: e instanceof Error ? e.message : String(e) }));
  catalogCache.set(lang, p);
  return p;
}
