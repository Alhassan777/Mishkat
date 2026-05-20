"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings-store";
import { fetchCatalog, type QuranCatalog } from "@/lib/quran/client";

export function SettingsPopover() {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<QuranCatalog | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const s = useSettings();

  useEffect(() => {
    if (open && !catalog) fetchCatalog().then(setCatalog);
  }, [open, catalog]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const englishOnly = <T extends { languageName?: string }>(rows: T[] | undefined): T[] =>
    rows?.filter((r) => /english/i.test(r.languageName ?? "")) ?? [];

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface/40 text-text-muted transition hover:border-hairline-strong hover:text-ink-bright"
        aria-label="Settings"
      >
        <GearIcon />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[320px] overflow-hidden rounded-xl border border-hairline-strong bg-ocean-deep/95 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl rise"
        >
          <div className="border-b border-hairline px-4 py-3">
            <div className="font-sans text-[10.5px] uppercase tracking-[0.32em] text-text-faint">
              Preferences
            </div>
            <div className="mt-0.5 font-sans text-[13px] text-text">Reading & recitation</div>
          </div>

          <div className="thin-scroll max-h-[60vh] overflow-y-auto p-4">
            {catalog && catalog.available === false && (
              <CredsHint reason={catalog.reason} />
            )}
            {catalog?.available && catalog.error && (
              <p className="rounded-lg border border-hairline bg-surface/40 px-3 py-2 font-sans text-[12px] text-text-muted">
                {catalog.error}
              </p>
            )}

            <Toggle
              label="Word-by-word"
              hint="Hover any word for meaning + transliteration"
              value={s.showWordByWord}
              onChange={(v) => s.set("showWordByWord", v)}
            />
            <Toggle
              label="Translation"
              hint="Show the verse translation under the Arabic text"
              value={s.showTranslation}
              onChange={(v) => s.set("showTranslation", v)}
            />
            <Toggle
              label="Tafsīr"
              hint="Show classical commentary in the detail drawer"
              value={s.showTafsir}
              onChange={(v) => s.set("showTafsir", v)}
            />

            {catalog?.available && (
              <>
                <Picker
                  label="Translation"
                  options={englishOnly(catalog.translations).map((t) => ({
                    id: t.id!,
                    label: t.name ?? `#${t.id}`,
                  }))}
                  value={s.translationId}
                  onChange={(v) => s.set("translationId", v)}
                />
                <Picker
                  label="Tafsīr"
                  options={englishOnly(catalog.tafsirs).map((t) => ({
                    id: t.id!,
                    label: t.name ?? `#${t.id}`,
                  }))}
                  value={s.tafsirId}
                  onChange={(v) => s.set("tafsirId", v)}
                />
                <Picker
                  label="Reciter"
                  options={(catalog.reciters ?? []).map((r) => ({
                    id: r.id!,
                    label: r.style
                      ? `${r.reciterName} · ${r.style}`
                      : r.reciterName ?? `#${r.id}`,
                  }))}
                  value={s.reciterId}
                  onChange={(v) => s.set("reciterId", v)}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-surface/40 px-3 py-2.5 transition hover:border-hairline-strong">
      <div className="flex-1">
        <div className="font-sans text-[12.5px] text-text">{label}</div>
        <div className="font-sans text-[10.5px] text-text-faint">{hint}</div>
      </div>
      <span
        className={`relative mt-0.5 inline-flex h-4 w-7 shrink-0 items-center rounded-full transition ${
          value ? "bg-ink/70" : "bg-text-faint/30"
        }`}
      >
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-ocean-deep transition ${
            value ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  );
}

function Picker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 font-sans text-[10.5px] uppercase tracking-[0.28em] text-text-faint">
        {label}
      </div>
      <CustomSelect options={options} value={value} onChange={onChange} />
    </div>
  );
}

function CustomSelect({
  options,
  value,
  onChange,
}: {
  options: { id: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIdx(Math.max(0, options.findIndex((o) => o.id === value)));
  }, [open, options, value]);

  useEffect(() => {
    if (!open || activeIdx < 0) return;
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[activeIdx];
      if (opt) {
        onChange(opt.id);
        setOpen(false);
      }
    }
  };

  return (
    <div ref={wrapRef} className="relative" onKeyDown={onKey}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-surface/60 px-3 py-1.5 text-left font-sans text-[11px] text-text outline-none transition ${
          open
            ? "border-hairline-strong shadow-[0_0_0_1px_rgba(212,175,55,0.18)]"
            : "border-hairline hover:border-hairline-strong"
        }`}
      >
        <span className={`truncate ${selected ? "text-text" : "text-text-faint"}`}>
          {selected?.label ?? "—"}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-md border border-hairline-strong bg-ocean-deep/95 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl rise">
          <ul
            ref={listRef}
            role="listbox"
            className="thin-scroll max-h-56 overflow-y-auto py-1"
          >
            {options.length === 0 && (
              <li className="px-3 py-1.5 font-sans text-[11px] text-text-faint">
                No options
              </li>
            )}
            {options.map((o, i) => {
              const isSelected = o.id === value;
              const isActive = i === activeIdx;
              return (
                <li
                  key={o.id}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 font-sans text-[11px] transition ${
                    isActive ? "bg-ink/[0.10]" : ""
                  } ${isSelected ? "text-ink-bright" : "text-text"}`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSelected && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2.5 6.2l2.4 2.4L9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      className={`shrink-0 text-text-faint transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M3 4.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CredsHint({ reason }: { reason?: string }) {
  return (
    <div className="mb-4 rounded-lg border border-hairline-strong bg-surface/50 px-3 py-3 text-left">
      <div className="font-sans text-[10.5px] uppercase tracking-[0.28em] text-ink">
        Setup required
      </div>
      <p className="mt-1 font-sans text-[12px] leading-[1.5] text-text-muted">
        {reason ?? "Quran.com API credentials are not configured."} Add{" "}
        <code className="rounded bg-ocean px-1 py-0.5 text-ink">QURAN_CLIENT_ID</code> and{" "}
        <code className="rounded bg-ocean px-1 py-0.5 text-ink">QURAN_CLIENT_SECRET</code> to{" "}
        <code className="rounded bg-ocean px-1 py-0.5 text-ink">.env.local</code> to enable
        word-by-word, audio, translations, and tafsīr. Register at{" "}
        <a
          href="https://api-docs.quran.foundation/"
          target="_blank"
          rel="noreferrer"
          className="text-ink-bright underline-offset-2 hover:underline"
        >
          api-docs.quran.foundation
        </a>
        .
      </p>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
