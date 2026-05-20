"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

const CDN = "https://verses.quran.foundation/";

/**
 * Plays a single verse recitation. The Quran.com Verse response gives a
 * relative path under `verses.quran.foundation`; we resolve it lazily and
 * keep a singleton <audio> element per button so toggling is instant.
 */
export function AudioButton({
  url,
  size = 22,
  label,
}: {
  url: string | undefined;
  size?: number;
  label?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const t = useT();

  useEffect(() => () => audioRef.current?.pause(), []);

  const onClick = () => {
    if (!url) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(resolveUrl(url));
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.onpause = () => setPlaying(false);
      audioRef.current.onplay = () => setPlaying(true);
    }
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else {
      audioRef.current.play().catch(() => setPlaying(false));
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={!url}
      title={label ?? t.audioRecite}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border border-hairline bg-surface/40 px-2.5 text-[10.5px] uppercase tracking-[0.2em] text-text-muted transition hover:border-hairline-strong hover:text-ink-bright disabled:opacity-40 ${
        t.isRTL ? "font-arabic" : "font-sans"
      }`}
    >
      {playing ? <PauseGlyph size={size} /> : <PlayGlyph size={size} />}
      {label && <span>{label}</span>}
    </button>
  );
}

export function resolveUrl(path: string): string {
  if (/^https?:/i.test(path)) return path;
  return CDN + path.replace(/^\/+/, "");
}

function PlayGlyph({ size }: { size: number }) {
  const s = size * 0.45;
  return (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="currentColor">
      <path d="M3 1.5v9l8-4.5z" />
    </svg>
  );
}
function PauseGlyph({ size }: { size: number }) {
  const s = size * 0.45;
  return (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="currentColor">
      <rect x="3" y="2" width="2.4" height="8" rx="0.5" />
      <rect x="6.6" y="2" width="2.4" height="8" rx="0.5" />
    </svg>
  );
}
