/**
 * Pinned tafsīr whitelist.
 *
 * Quran.com exposes hundreds of tafsīrs in many languages; we surface only
 * these four classical works. Each entry pairs a stable language-agnostic
 * `key` with the Quran.Foundation Content API resource ids for the English
 * and Arabic editions (ids verified against `/content/api/v4/resources/tafsirs`).
 *
 * The settings store persists `tafsirKey`; the actual id passed to the
 * verse-fetch endpoint is resolved here based on the active UI language —
 * Arabic mode pulls the Arabic edition (e.g. تفسير ابن كثير) while English
 * mode pulls the English edition where one exists.
 */

import type { Lang } from "@/lib/i18n";

export type TafsirKey = "ibn-kathir" | "tabari" | "sa-di" | "muyassar";

type PinnedTafsir = {
  key: TafsirKey;
  /** id of the English edition; falls back to Arabic when no English work exists. */
  en: number;
  /** id of the Arabic edition. */
  ar: number;
  labelEn: string;
  labelAr: string;
};

export const TAFSIRS: PinnedTafsir[] = [
  { key: "ibn-kathir", en: 169, ar: 14, labelEn: "Ibn Kathīr", labelAr: "تفسير ابن كثير" },
  { key: "tabari", en: 15, ar: 15, labelEn: "al-Ṭabarī", labelAr: "تفسير الطبري" },
  { key: "sa-di", en: 91, ar: 91, labelEn: "as-Saʿdī", labelAr: "تفسير السعدي" },
  { key: "muyassar", en: 16, ar: 16, labelEn: "al-Muyassar", labelAr: "التفسير الميسر" },
];

export function tafsirByKey(key: TafsirKey): PinnedTafsir {
  return TAFSIRS.find((t) => t.key === key) ?? TAFSIRS[0];
}

/**
 * Resolve a stable `tafsirKey` + active language to the concrete API id.
 * Tabarī / Saʿdī / Muyassar only exist in Arabic, so the English caller
 * still gets the Arabic resource for those works — the picker label is
 * what changes per UI language.
 */
export function resolveTafsirId(key: TafsirKey, lang: Lang): number {
  const t = tafsirByKey(key);
  return lang === "ar" ? t.ar : t.en;
}

export function tafsirLabel(key: TafsirKey, lang: Lang): string {
  const t = tafsirByKey(key);
  return lang === "ar" ? t.labelAr : t.labelEn;
}

/**
 * The *content* language of the tafsīr that will be served for (key, lang).
 * Tafsīrs whose `en` and `ar` editions point at the same id only exist in
 * Arabic, so English mode still receives Arabic text for those works.
 */
export function tafsirLanguage(key: TafsirKey, lang: Lang): "ar" | "en" {
  const t = tafsirByKey(key);
  if (t.en === t.ar) return "ar";
  return lang === "ar" ? "ar" : "en";
}

/**
 * Best-effort migration from a legacy tafsīr id to a stable key. Any id
 * that matches one of the pinned editions maps cleanly; everything else
 * defaults to Ibn Kathīr.
 */
export function tafsirIdToKey(id: number | undefined): TafsirKey {
  if (id == null) return "ibn-kathir";
  for (const t of TAFSIRS) {
    if (t.en === id || t.ar === id) return t.key;
  }
  return "ibn-kathir";
}
