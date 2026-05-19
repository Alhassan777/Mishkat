"use client";

import { useState } from "react";
import type { Tafsir } from "@quranjs/api";

/**
 * Renders a classical tafsīr (commentary) excerpt with a "read more"
 * affordance. The text from the API contains light HTML; we render it
 * as innerHTML after stripping anything that could be unsafe.
 */
function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/ on[a-z]+="[^"]*"/gi, "")
    .replace(/ on[a-z]+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export function TafsirPanel({ tafsir }: { tafsir: Tafsir | undefined }) {
  const [open, setOpen] = useState(false);
  if (!tafsir?.text) return null;

  const isArabic = /^ar/i.test(tafsir.languageName ?? "");
  const className = isArabic
    ? "font-arabic text-[15.5px] leading-[2.05] text-text"
    : "font-sans text-[13.5px] leading-[1.7] text-text";

  return (
    <div className="mt-4 rounded-lg border border-hairline bg-surface/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-ink/[0.04]"
      >
        <span className="flex flex-col gap-0.5">
          <span className="font-sans text-[10.5px] uppercase tracking-[0.28em] text-text-faint">
            Commentary
          </span>
          <span className="font-sans text-[13px] text-text">
            {tafsir.resourceName ?? "Tafsīr"}
          </span>
        </span>
        <span
          className={`text-ink transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="m1 3 4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div
          className={`border-t border-hairline px-4 py-4 ${className} thin-scroll max-h-[44vh] overflow-y-auto`}
          dir={isArabic ? "rtl" : "ltr"}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: sanitize(tafsir.text) }}
        />
      )}
    </div>
  );
}
