"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGraphStore } from "@/lib/store";
import type { GraphData } from "@/types/graph";

export function SearchBar() {
  const graph = useGraphStore((s) => s.graph);
  const setSelected = useGraphStore((s) => s.setSelectedNode);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto group absolute left-1/2 top-7 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-hairline bg-surface/55 px-5 py-2 backdrop-blur-md transition hover:border-hairline-strong hover:bg-surface/75"
      >
        <SearchIcon />
        <span className="font-sans text-[12.5px] text-text-muted">
          Search āyah · <span className="text-text-faint">2:255</span>
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
            className="w-[min(560px,92vw)] overflow-hidden rounded-2xl border border-hairline-strong bg-surface/90 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.6)] rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-hairline px-5 py-4">
              <SearchIcon />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Reference (2:255), surah, or Arabic phrase…"
                className="flex-1 bg-transparent font-sans text-[15px] text-text placeholder:text-text-faint focus:outline-none"
              />
              <span className="font-sans text-[10.5px] uppercase tracking-[0.24em] text-text-faint">
                Esc
              </span>
            </div>
            <div className="max-h-[52vh] overflow-y-auto thin-scroll">
              {results.length === 0 && q && (
                <div className="px-5 py-8 text-center font-sans text-[13px] text-text-faint">
                  No āyah matched. Try a reference like <em>4:56</em>.
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
                    className="flex w-full items-center gap-4 border-t border-hairline px-5 py-3 text-left transition hover:bg-ink/[0.06]"
                  >
                    <span className="w-12 font-sans text-[12px] tracking-wider text-ink">
                      {node.s}:{node.a}
                    </span>
                    <span className="flex-1 truncate font-quran text-[19px] leading-[1.6] text-text" dir="rtl">
                      {node.t}
                    </span>
                    <span className="font-sans text-[11px] text-text-faint whitespace-nowrap">
                      {node.sn}
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

function searchNodes(graph: GraphData, q: string): string[] {
  const query = q.trim().toLowerCase();
  if (!query) {
    // Default: the 20 most-connected ayāt as "discover" suggestions.
    return Object.entries(graph.nodes)
      .sort((a, b) => b[1].e.length - a[1].e.length)
      .slice(0, 20)
      .map(([id]) => id);
  }
  const refMatch = query.match(/^(\d{1,3})\s*[:.\-]\s*(\d{1,3})$/);
  if (refMatch) {
    const id = `${refMatch[1]}:${refMatch[2]}`;
    return graph.nodes[id] ? [id] : [];
  }
  const out: string[] = [];
  for (const [id, n] of Object.entries(graph.nodes)) {
    const hay = `${(n.sn ?? "").toLowerCase()} ${n.sna ?? ""} ${n.t ?? ""}`;
    if (hay.includes(query) || hay.includes(q)) out.push(id);
    if (out.length >= 40) break;
  }
  return out;
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="#d4af37" strokeWidth="1.6" />
      <path d="m20 20-3.5-3.5" stroke="#d4af37" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
