"use client";

import { useState } from "react";
import type { Word } from "@quranjs/api";

/**
 * Renders the verse as discrete hoverable word tokens. Each token reveals
 * its translation + transliteration in a floating chip on hover.
 *
 * `diffMask` is an optional set of word indices (corresponding to the
 * `words` array order) whose tokens should be visually highlighted as
 * unique to this verse (i.e. absent from its comparison pair).
 */
export function WordTokens({
  words,
  size = 25,
  diffMask,
}: {
  words: Word[];
  size?: number;
  diffMask?: Set<number>;
}) {
  const [active, setActive] = useState<number | null>(null);
  // Filter "End" / "Pause" markers — they're not actual lexical words.
  const tokens = words.filter((w) => w.charTypeName === "word");

  return (
    <div
      className="flex flex-wrap gap-x-3 gap-y-2 leading-[2.05]"
      dir="rtl"
      lang="ar"
    >
      {tokens.map((w, i) => {
        const isDiff = diffMask?.has(i);
        const open = active === i;
        return (
          <span
            key={i}
            className="relative inline-flex"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive((v) => (v === i ? null : v))}
          >
            <span
              className={`cursor-help font-quran transition ${
                isDiff
                  ? "rounded-md bg-ink/[0.12] px-1.5 text-ink-bright ring-1 ring-inset ring-hairline-strong"
                  : "text-text hover:text-ink-bright"
              }`}
              style={{ fontSize: size }}
            >
              {w.textUthmani ?? w.text}
            </span>
            {open && (
              <span
                dir="ltr"
                className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 w-max max-w-[240px] -translate-x-1/2 rounded-md border border-hairline-strong bg-ocean-deep/95 px-2.5 py-1.5 text-left font-sans text-[11px] leading-[1.45] text-text shadow-[0_8px_24px_-4px_rgba(0,0,0,0.6)] backdrop-blur"
              >
                <span className="block text-ink">{w.translation?.text}</span>
                {w.transliteration?.text && (
                  <span className="mt-0.5 block italic text-text-faint">
                    {w.transliteration.text}
                  </span>
                )}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
