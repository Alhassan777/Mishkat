"use client";

import { useGraphStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { CATEGORY_COLOR, type Category } from "@/types/graph";

const CATEGORIES: Category[] = [
  "structural",
  "semantic",
  "doctrinal",
  "lexical",
  "cross_surah_refrain",
  "thematic",
];

export function FilterRail() {
  const active = useGraphStore((s) => s.activeCategories);
  const toggle = useGraphStore((s) => s.toggleCategory);
  const clear = useGraphStore((s) => s.clearCategories);
  const t = useT();

  const hint =
    active.size === 0
      ? t.filterHintIdle
      : active.size === 1
        ? t.filterHintOne
        : t.filterHintMany(active.size);

  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-7 z-30 flex flex-col items-center gap-3">
      <div className={`text-[10.5px] font-bold uppercase tracking-[0.32em] text-text-faint ${sansForLang}`}>
        {hint}
      </div>
      <div className="hairline w-40 opacity-60" />
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-hairline bg-surface/55 px-2.5 py-1.5 backdrop-blur-md">
        <span className={`ml-2 mr-1 text-[10.5px] uppercase tracking-[0.26em] text-text-faint ${sansForLang}`}>
          {t.filterLens}
        </span>
        {CATEGORIES.map((c) => {
          const on = active.has(c);
          const color = CATEGORY_COLOR[c];
          return (
            <button
              key={c}
              onClick={() => toggle(c)}
              className={`group flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] transition ${sansForLang} ${
                on
                  ? "border-hairline-strong bg-ink/[0.12] text-text"
                  : "border-transparent text-text-muted hover:bg-ink/[0.05] hover:text-text"
              }`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: color,
                  boxShadow: on ? `0 0 8px ${color}` : "none",
                }}
              />
              {t.category[c]}
            </button>
          );
        })}
        {active.size > 0 && (
          <button
            onClick={clear}
            className={`ml-1 rounded-full px-2 py-1 text-[10.5px] uppercase tracking-[0.2em] text-text-faint transition hover:text-text ${sansForLang}`}
          >
            {t.filterClear}
          </button>
        )}
      </div>
    </div>
  );
}
