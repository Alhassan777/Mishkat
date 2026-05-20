"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings-store";
import { useT } from "@/lib/i18n";
import { fetchCatalog, type QuranCatalog } from "@/lib/quran/client";
import { TAFSIRS, tafsirLabel, type TafsirKey } from "@/lib/quran/tafsirs";

export function SettingsPopover() {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<QuranCatalog | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const s = useSettings();
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";

  // Reset the cached catalog when the UI language changes so picker labels
  // refetch in the active language (Arabic ⇄ English `translatedName`).
  useEffect(() => {
    setCatalog(null);
  }, [t.lang]);

  useEffect(() => {
    if (open && !catalog) fetchCatalog(t.lang).then(setCatalog);
  }, [open, catalog, t.lang]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || btnRef.current?.contains(target)) return;
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

  // Translations only have meaningful `name` in English; filter to those.
  const englishOnly = <T extends { languageName?: string }>(rows: T[] | undefined): T[] =>
    rows?.filter((r) => /english/i.test(r.languageName ?? "")) ?? [];

  type Named = {
    id?: number;
    name?: string;
    translatedName?: { name?: string };
  };
  const displayName = (r: Named) =>
    r.translatedName?.name || r.name || `#${r.id}`;
  const reciterDisplayName = (r: {
    id?: number;
    reciterName?: string;
    style?: string;
    translatedName?: { name?: string };
  }) => {
    const base = r.translatedName?.name || r.reciterName || `#${r.id}`;
    return r.style ? `${base} · ${r.style}` : base;
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface/40 text-text-muted transition hover:border-hairline-strong hover:text-ink-bright"
        aria-label={t.settingsAria}
      >
        <GearIcon />
      </button>
      {open && (
        <div
          ref={panelRef}
          className={`absolute top-[calc(100%+10px)] z-50 w-[320px] overflow-hidden rounded-xl border border-hairline-strong bg-ocean-deep/95 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl rise ${
            t.isRTL ? "left-0" : "right-0"
          }`}
        >
          <div className="border-b border-hairline px-4 py-3">
            <div className={`text-[10.5px] uppercase tracking-[0.32em] text-text-faint ${sansForLang}`}>
              {t.settingsTitle}
            </div>
            <div className={`mt-0.5 text-[13px] text-text ${sansForLang}`}>{t.settingsSubtitle}</div>
          </div>

          <div className="thin-scroll max-h-[60vh] overflow-y-auto p-4">
            {catalog && catalog.available === false && (
              <CredsHint reason={catalog.reason} />
            )}
            {catalog?.available && catalog.error && (
              <p className={`rounded-lg border border-hairline bg-surface/40 px-3 py-2 text-[12px] text-text-muted ${sansForLang}`}>
                {catalog.error}
              </p>
            )}

            <Toggle
              label={t.settingsWordByWord}
              hint={t.settingsWordByWordHint}
              value={s.showWordByWord}
              onChange={(v) => s.set("showWordByWord", v)}
            />
            <Toggle
              label={t.settingsTranslation}
              hint={t.settingsTranslationHint}
              value={s.showTranslation}
              onChange={(v) => s.set("showTranslation", v)}
            />
            <Toggle
              label={t.settingsTafsir}
              hint={t.settingsTafsirHint}
              value={s.showTafsir}
              onChange={(v) => s.set("showTafsir", v)}
            />

            {catalog?.available && (
              <>
                <Picker
                  label={t.settingsTranslationPicker}
                  options={englishOnly(catalog.translations).map((r) => ({
                    id: r.id!,
                    label: displayName(r),
                  }))}
                  value={s.translationId}
                  onChange={(v) => s.set("translationId", v)}
                />
                <Picker<TafsirKey>
                  label={t.settingsTafsirPicker}
                  options={TAFSIRS.map((tf) => ({
                    id: tf.key,
                    label: tafsirLabel(tf.key, t.lang),
                  }))}
                  value={s.tafsirKey}
                  onChange={(v) => s.set("tafsirKey", v)}
                />
                <Picker
                  label={t.settingsReciter}
                  options={(catalog.reciters ?? []).map((r) => ({
                    id: r.id!,
                    label: reciterDisplayName(r),
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
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";
  return (
    <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-surface/40 px-3 py-2.5 transition hover:border-hairline-strong">
      <div className="flex-1">
        <div className={`text-[12.5px] text-text ${sansForLang}`}>{label}</div>
        <div className={`text-[10.5px] text-text-faint ${sansForLang}`}>{hint}</div>
      </div>
      <span
        dir="ltr"
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
            t.isRTL
              ? value
                ? "translate-x-0.5"
                : "translate-x-3.5"
              : value
                ? "translate-x-3.5"
                : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  );
}

function Picker<Id extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: Id; label: string }[];
  value: Id;
  onChange: (v: Id) => void;
}) {
  const t = useT();
  return (
    <div className="mb-3">
      <div className={`mb-1 text-[10.5px] uppercase tracking-[0.28em] text-text-faint ${t.isRTL ? "font-arabic" : "font-sans"}`}>
        {label}
      </div>
      <CustomSelect options={options} value={value} onChange={onChange} />
    </div>
  );
}

function CustomSelect<Id extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { id: Id; label: string }[];
  value: Id;
  onChange: (v: Id) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.id === value);
  const t = useT();
  const fontForLang = t.isRTL ? "font-arabic" : "font-sans";
  const sizeForLang = t.isRTL ? "text-[12.5px]" : "text-[11px]";

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
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-surface/60 px-3 py-1.5 text-text outline-none transition ${
          t.isRTL ? "text-right" : "text-left"
        } ${fontForLang} ${sizeForLang} ${
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
              <li className={`px-3 py-1.5 text-text-faint ${fontForLang} ${sizeForLang}`}>
                —
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
                  className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 transition ${fontForLang} ${sizeForLang} ${
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
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";
  return (
    <div className={`mb-4 rounded-lg border border-hairline-strong bg-surface/50 px-3 py-3 ${t.isRTL ? "text-right" : "text-left"}`}>
      <div className={`text-[10.5px] uppercase tracking-[0.28em] text-ink ${sansForLang}`}>
        {t.settingsSetup}
      </div>
      <p className={`mt-1 text-[12px] leading-[1.5] text-text-muted ${sansForLang}`}>
        {reason ?? t.settingsSetupBody}{" "}
        <a
          href="https://api-docs.quran.foundation/"
          target="_blank"
          rel="noreferrer"
          className="text-ink-bright underline-offset-2 hover:underline"
        >
          api-docs.quran.foundation
        </a>
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
