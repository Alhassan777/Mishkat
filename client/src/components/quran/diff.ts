import { stripArabicDiacritics, unifyArabicLetters } from "@/lib/arabic";

/**
 * Mark words that don't have a counterpart in the other verse.
 *
 * Set-based (O(n+m)): scholarly opinions about word_substitution /
 * addition_omission usually mean "this word is here but missing there",
 * so presence is the right test.
 *
 * Unlike the search normalizer, this strips non-Arabic glyphs so
 * pause/end markers don't pollute the comparison.
 */

export function normalizeArabic(text: string): string {
  return unifyArabicLetters(stripArabicDiacritics(text))
    .replace(/[^؀-ۿ]/g, "")
    .trim();
}

export function diffWordSets(
  wordsA: string[],
  wordsB: string[],
): { uniqueA: Set<number>; uniqueB: Set<number> } {
  const setA = new Set(wordsA.map(normalizeArabic).filter(Boolean));
  const setB = new Set(wordsB.map(normalizeArabic).filter(Boolean));
  const uniqueA = new Set<number>();
  const uniqueB = new Set<number>();
  wordsA.forEach((w, i) => {
    const n = normalizeArabic(w);
    if (n && !setB.has(n)) uniqueA.add(i);
  });
  wordsB.forEach((w, i) => {
    const n = normalizeArabic(w);
    if (n && !setA.has(n)) uniqueB.add(i);
  });
  return { uniqueA, uniqueB };
}
