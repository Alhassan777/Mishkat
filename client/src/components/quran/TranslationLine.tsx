"use client";

import type { Translation } from "@quranjs/api";

/**
 * Strips Quran.com's footnote markers ("<sup>...") from the rendered text
 * — they reference a separate footnote table we don't display.
 */
function clean(text: string | undefined): string {
  if (!text) return "";
  return text.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, "");
}

export function TranslationLine({ translation }: { translation: Translation | undefined }) {
  if (!translation?.text) return null;
  return (
    <p
      className="mt-3 font-sans text-[13px] italic leading-[1.7] text-text-muted"
      dir="ltr"
    >
      <span className="mr-2 text-text-faint">“</span>
      {clean(translation.text)}
      <span className="ml-1 text-text-faint">”</span>
      {translation.resourceName && (
        <span className="ml-2 not-italic font-sans text-[10px] uppercase tracking-[0.22em] text-text-faint">
          · {translation.resourceName}
        </span>
      )}
    </p>
  );
}
