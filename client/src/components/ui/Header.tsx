"use client";

import { SettingsPopover } from "./SettingsPopover";
import { LangSwitch } from "./LangSwitch";
import { SignInWidget } from "@/components/auth/SignInWidget";
import { useT } from "@/lib/i18n";

export function Header() {
  const t = useT();
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-8 pt-7">
      <div className="pointer-events-auto flex items-center gap-3">
        <Mark />
        <div className="leading-tight">
          <div
            className={`font-semibold uppercase text-text ${
              t.isRTL
                ? "font-arabic text-[15px] tracking-[0.12em]"
                : "font-sans text-[11px] tracking-[0.32em]"
            }`}
          >
            {t.brand}
          </div>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-text-faint">
        <SignInWidget />
        <LangSwitch />
        <SettingsPopover />
      </div>
    </header>
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
