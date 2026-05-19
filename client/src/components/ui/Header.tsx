"use client";

import { useGraphStore } from "@/lib/store";
import { SettingsPopover } from "./SettingsPopover";

export function Header() {
  const graph = useGraphStore((s) => s.graph);
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-8 pt-7">
      <div className="pointer-events-auto flex items-center gap-3">
        <Mark />
        <div className="leading-tight">
          <div className="font-quran text-[22px] text-ink-bright tracking-wide" dir="rtl">
            آيات
          </div>
          <div className="font-sans text-[10.5px] uppercase tracking-[0.32em] text-text-faint">
            The Infinite Ink
          </div>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-6 text-[11px] uppercase tracking-[0.28em] text-text-faint">
        {graph && (
          <>
            <Stat label="Āyāt" value={graph.meta.nodes.toLocaleString()} />
            <Stat label="Threads" value={graph.meta.edges.toLocaleString()} />
            <Stat label="Scholars" value={graph.meta.books.toString()} />
          </>
        )}
        <SettingsPopover />
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="font-sans text-[15px] tracking-normal text-text">{value}</span>
      <span className="mt-0.5">{label}</span>
    </div>
  );
}

function Mark() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden>
      <defs>
        <radialGradient id="m-g" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#f5d97a" stopOpacity="1" />
          <stop offset="60%" stopColor="#d4af37" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="url(#m-g)" />
      <circle cx="20" cy="20" r="5.4" fill="#fff1b8" />
      <g stroke="#d4af37" strokeWidth="0.7" opacity="0.55" fill="none">
        <circle cx="20" cy="20" r="11" />
        <path d="M20 9 L20 31 M9 20 L31 20 M12 12 L28 28 M28 12 L12 28" />
      </g>
    </svg>
  );
}
