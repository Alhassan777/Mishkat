"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGraphStore } from "@/lib/store";
import { fuzzyIncludes, normalizeForSearch } from "@/lib/arabic";
import { useT } from "@/lib/i18n";
import type { GraphData } from "@/types/graph";

export function SearchBar() {
  const graph = useGraphStore((s) => s.graph);
  const setSelected = useGraphStore((s) => s.setSelectedNode);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  // Cmd/Ctrl+K opens, Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const results = useMemo(() => (graph ? searchNodes(graph, q) : []), [graph, q]);
  const hitTokens = useMemo(() => extractTokens(q), [q]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto group absolute left-1/2 top-7 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-hairline bg-surface/55 px-5 py-2 backdrop-blur-md transition hover:border-hairline-strong hover:bg-surface/75"
      >
        <SearchIcon />
        <span className={`text-[12.5px] text-text-muted ${t.isRTL ? "font-arabic" : "font-sans"}`}>
          {t.searchHint} · <span className="text-text-faint">{t.searchExample}</span>
        </span>
        <kbd className="rounded border border-hairline px-1.5 py-0.5 font-sans text-[10px] tracking-wider text-text-faint">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="pointer-events-auto fixed inset-0 z-50 flex items-start justify-center bg-ocean-deep/70 backdrop-blur-sm pt-[14vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex flex-col overflow-hidden rounded-2xl border border-hairline-strong bg-surface/90 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.6)] rise resize"
            style={{
              width: "min(560px, 92vw)",
              height: "min(60vh, 640px)",
              minWidth: "320px",
              minHeight: "200px",
              maxWidth: "96vw",
              maxHeight: "86vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-hairline px-5 py-4">
              <SearchIcon />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.searchPlaceholder}
                dir="auto"
                className={`flex-1 bg-transparent leading-[1.4] text-text placeholder:text-text-faint placeholder:text-[14px] focus:outline-none ${
                  t.isRTL ? "placeholder:font-arabic" : "placeholder:font-sans"
                } ${
                  /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(q)
                    ? "font-quran text-[22px]"
                    : "font-sans text-[16px]"
                }`}
              />
              <span className={`text-[10.5px] uppercase tracking-[0.24em] text-text-faint ${t.isRTL ? "font-arabic" : "font-sans"}`}>
                {t.searchEsc}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto thin-scroll">
              {results.length === 0 && q && (
                <div className={`px-5 py-8 text-center text-[13px] text-text-faint ${t.isRTL ? "font-arabic" : "font-sans"}`}>
                  {t.searchNoMatch("4:56")}
                </div>
              )}
              {results.map((id) => {
                const node = graph!.nodes[id];
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setSelected(id);
                      setOpen(false);
                      setQ("");
                    }}
                    className="flex w-full items-start gap-4 border-t border-hairline px-5 py-3 text-left transition hover:bg-ink/[0.06]"
                  >
                    <span className="w-12 shrink-0 pt-1 font-sans text-[12px] tracking-wider text-ink">
                      {node.s}:{node.a}
                    </span>
                    <span className="flex-1 text-right font-quran text-[19px] leading-[1.6] text-text" dir="rtl">
                      <Highlight text={node.t} tokens={hitTokens} />
                    </span>
                    <span className="shrink-0 pt-1 font-sans text-[11px] text-text-faint whitespace-nowrap">
                      <Highlight text={node.sn} tokens={hitTokens} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------- search core ------------------------------ */

type IndexedRow = {
  id: string;
  s: number;
  a: number;
  degree: number;
  /** "al baqara" — Latin surah name, normalized + "al-" prefix optional. */
  surahLatin: string;
  surahLatinNoAl: string;
  /** "البقره" — Arabic surah name, normalized. */
  surahArabic: string;
  /** Normalized verse text — diacritics/letter-folded for substring match. */
  textN: string;
};

// Build once per GraphData (graph rarely changes, but be safe with WeakMap).
const indexCache = new WeakMap<GraphData, IndexedRow[]>();

function getIndex(graph: GraphData): IndexedRow[] {
  const cached = indexCache.get(graph);
  if (cached) return cached;
  const rows: IndexedRow[] = [];
  for (const [id, n] of Object.entries(graph.nodes)) {
    const surahLatin = normalizeForSearch(n.sn ?? "");
    rows.push({
      id,
      s: n.s,
      a: n.a,
      degree: n.e.length,
      surahLatin,
      surahLatinNoAl: surahLatin.replace(/^al\s+/, ""),
      surahArabic: normalizeForSearch(n.sna ?? ""),
      textN: normalizeForSearch(n.t ?? ""),
    });
  }
  indexCache.set(graph, rows);
  return rows;
}

function defaultSuggestions(graph: GraphData): string[] {
  return Object.entries(graph.nodes)
    .sort((a, b) => b[1].e.length - a[1].e.length)
    .slice(0, 20)
    .map(([id]) => id);
}

/**
 * Normalize the user's query into the same token form the ranker uses.
 * Returns [] for empty / reference / surah-only queries so the highlight
 * layer stays inert in those cases.
 */
export function extractTokens(raw: string): string[] {
  const q = raw.trim();
  if (!q) return [];
  if (/^(\d{1,3})\s*[:.\-]\s*(\d{1,3})$/.test(q)) return [];
  if (/^\d{1,3}$/.test(q)) return [];
  return normalizeForSearch(q)
    .split(/\s+/)
    .map((t) => t.replace(/^al-?/, ""))
    .filter(Boolean);
}

function searchNodes(graph: GraphData, raw: string): string[] {
  const q = raw.trim();
  if (!q) return defaultSuggestions(graph);

  // Reference like "2:255" / "2.255" / "2-255" — exact, single hit.
  const refMatch = q.match(/^(\d{1,3})\s*[:.\-]\s*(\d{1,3})$/);
  if (refMatch) {
    const id = `${refMatch[1]}:${refMatch[2]}`;
    return graph.nodes[id] ? [id] : [];
  }

  // Just a surah number? Surface its first ayāt as suggestions.
  const surahOnly = q.match(/^(\d{1,3})$/);
  if (surahOnly) {
    const s = Number(surahOnly[1]);
    return Object.entries(graph.nodes)
      .filter(([, n]) => n.s === s)
      .sort((a, b) => a[1].a - b[1].a)
      .slice(0, 40)
      .map(([id]) => id);
  }

  const tokens = extractTokens(q);
  if (tokens.length === 0) return [];

  const idx = getIndex(graph);
  const scored: { id: string; score: number }[] = [];

  for (const row of idx) {
    let total = 0;
    let allMatch = true;

    for (const tok of tokens) {
      const inLatin = fuzzyIncludes(row.surahLatinNoAl, tok);
      const inArabic = fuzzyIncludes(row.surahArabic, tok);
      const inText = fuzzyIncludes(row.textN, tok);

      if (!inLatin && !inArabic && !inText) {
        allMatch = false;
        break;
      }

      // Strong signal: surah name prefix match.
      if (row.surahLatinNoAl.startsWith(tok) || row.surahArabic.startsWith(tok)) {
        total += 40;
      } else if (inLatin || inArabic) {
        total += 18;
      }
      // Substring inside the verse: weaker, but additive across tokens.
      if (inText) total += 4;
    }

    if (allMatch) {
      // Hub-bias tiebreaker so connection-rich ayāt surface first.
      total += Math.log2(row.degree + 1) * 0.6;
      // Earlier-in-mushaf bias for surah-only matches, so 2:1 beats 2:282.
      total += Math.max(0, 5 - row.a / 50);
      scored.push({ id: row.id, score: total });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 40).map((x) => x.id);
}

/**
 * Render a string with whitespace-bounded word tokens highlighted when
 * any normalized query token is a substring of the word's normalized form.
 *
 * We match on whole words (not raw substrings) so the highlight aligns
 * with what the reader's eye expects — never breaking in the middle of
 * an Arabic ligature.
 */
function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (!text) return null;
  if (tokens.length === 0) return <>{text}</>;
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/^\s+$/.test(part)) return <span key={i}>{part}</span>;
        const n = normalizeForSearch(part);
        const hit = tokens.some((t) => n.includes(t) || (t.length >= 5 && n.includes(t.slice(0, -1))));
        if (!hit) return <span key={i}>{part}</span>;
        return (
          <mark
            key={i}
            className="rounded bg-ink/[0.22] px-1 py-0.5 text-ink-bright ring-1 ring-inset ring-hairline-strong"
          >
            {part}
          </mark>
        );
      })}
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="#d4af37" strokeWidth="1.6" />
      <path d="m20 20-3.5-3.5" stroke="#d4af37" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
