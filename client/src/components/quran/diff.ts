/**
 * Mark words that don't have a counterpart in the other verse.
 *
 * Arabic words come in many vocalized forms; we strip diacritics and
 * normalize alif variants before comparison so morphology-level matches
 * still count as "same word". This is deliberately set-based (O(n+m))
 * rather than LCS-based: scholarly opinions about word_substitution /
 * addition_omission usually mean "this word is here but missing there",
 * so a presence check is what we want.
 */

const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

export function normalizeArabic(text: string): string {
  return text
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[آأإ]/g, "ا") // unify alif forms
    .replace(/ة/g, "ه") // tāʾ marbūṭa → hāʾ
    .replace(/ى/g, "ي") // alif maqṣūra → yāʾ
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
