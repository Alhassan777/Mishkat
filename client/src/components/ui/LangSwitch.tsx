"use client";

import { useLang } from "@/lib/i18n";

export function LangSwitch() {
  const lang = useLang((s) => s.lang);
  const toggle = useLang((s) => s.toggle);
  const isAr = lang === "ar";

  return (
    <button
      onClick={toggle}
      aria-label={isAr ? "Switch to English" : "تبديل إلى العربية"}
      title={isAr ? "English" : "العربية"}
      className={`flex h-8 items-center rounded-full border border-hairline bg-surface/40 px-3 text-text-muted transition hover:border-hairline-strong hover:text-ink-bright ${
        isAr
          ? "font-sans text-[11px] uppercase tracking-[0.22em]"
          : "font-arabic text-[13px]"
      }`}
    >
      {isAr ? "EN" : "العربية"}
    </button>
  );
}
