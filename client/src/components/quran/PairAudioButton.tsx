"use client";

import { useEffect, useRef, useState } from "react";
import { resolveUrl } from "./AudioButton";

/**
 * Recites two verses sequentially with a small pause between, so a user
 * can audibly compare a connected pair the way a Qārī would in tartīl.
 */
export function PairAudioButton({
  urlA,
  urlB,
  gapMs = 600,
}: {
  urlA: string | undefined;
  urlB: string | undefined;
  gapMs?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [stage, setStage] = useState<"idle" | "a" | "b">("idle");

  const stop = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    audioRef.current?.pause();
    setPlaying(false);
    setStage("idle");
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    if (!urlA || !urlB) return;
    if (playing) return stop();

    const audio = new Audio();
    audioRef.current = audio;
    setPlaying(true);

    setStage("a");
    audio.src = resolveUrl(urlA);
    try {
      await audio.play();
    } catch {
      stop();
      return;
    }
    audio.onended = () => {
      timerRef.current = window.setTimeout(async () => {
        setStage("b");
        audio.src = resolveUrl(urlB);
        try {
          await audio.play();
        } catch {
          stop();
          return;
        }
        audio.onended = () => stop();
      }, gapMs);
    };
  };

  return (
    <button
      onClick={start}
      disabled={!urlA || !urlB}
      className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/40 px-3.5 py-1.5 font-sans text-[11px] uppercase tracking-[0.22em] text-text-muted transition hover:border-hairline-strong hover:text-ink-bright disabled:opacity-40"
    >
      <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor">
        {playing ? (
          <>
            <rect x="3" y="2" width="2.4" height="8" rx="0.5" />
            <rect x="6.6" y="2" width="2.4" height="8" rx="0.5" />
          </>
        ) : (
          <path d="M3 1.5v9l8-4.5z" />
        )}
      </svg>
      {playing
        ? stage === "a"
          ? "Reciting A…"
          : "Reciting B…"
        : "Recite both"}
    </button>
  );
}
