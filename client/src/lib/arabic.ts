/**
 * Arabic + Latin text normalization for search and diffing.
 *
 * Quran text comes vocalized (full tashkīl) and uses several historically
 * distinct letter forms (آ أ إ ٱ for alif, ة vs ه, ى vs ي, …). A reader
 * typing in any modern keyboard layout will produce a different byte
 * sequence than what's on the page even when they're "looking for the
 * same word". This module folds all of those variants together so a
 * naïve substring search behaves the way a human expects.
 */

// Tashkīl: fatḥa, kasra, ḍamma, sukūn, shadda, tanwīns, dagger alif, and
// the Quranic small-letter range used for pause/stop marks.
const AR_DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const LATIN_DIACRITICS = /[̀-ͯ]/g;
// Spacing modifier letters used in academic transliteration (ʿayn, hamza,
// aspirated stops, etc.): ʿ ʾ ʼ ʻ ʰ ʷ — fold them away for matching.
const LATIN_MODIFIERS = /[ʰ-˿]/g;

export function stripArabicDiacritics(s: string): string {
  return s.replace(AR_DIACRITICS, "").replace(TATWEEL, "");
}

export function unifyArabicLetters(s: string): string {
  return s
    .replace(/[آأإٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

/**
 * Normalize a string so that semantically-equivalent inputs collide:
 * Arabic letter folding + tashkīl removal + Latin diacritic folding +
 * lowercasing + soft punctuation cleanup.
 *
 * Designed for *search*: it preserves all characters (Latin + Arabic),
 * unlike the diff-oriented helper that keeps only Arabic glyphs.
 */
export function normalizeForSearch(s: string): string {
  return unifyArabicLetters(stripArabicDiacritics(s))
    .normalize("NFD")
    .replace(LATIN_DIACRITICS, "")
    .replace(LATIN_MODIFIERS, "")
    .toLowerCase()
    .replace(/[-_'"`’“”]/g, " ")
    // Collapse doubled Latin letters — transliterations like "Imraan",
    // "Maaida", "Nisaa" become "imran", "maida", "nisa" so users typing
    // either form match. Only runs on a-z to keep Arabic intact (where
    // doubles aren't a notation choice).
    .replace(/([a-z])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tolerant substring match for short morphological tails. Catches
 * "baqarah" vs "baqara" and other ±1-char endings without dragging in a
 * full edit-distance library.
 */
export function fuzzyIncludes(haystack: string, needle: string): boolean {
  if (!needle) return true;
  if (haystack.includes(needle)) return true;
  if (needle.length >= 5 && haystack.includes(needle.slice(0, -1))) return true;
  return false;
}
