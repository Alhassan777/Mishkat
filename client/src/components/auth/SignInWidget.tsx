"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@/lib/user/store";
import { useGraphStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import type { GraphData } from "@/types/graph";

/**
 * Header chip. Signed-in users see a Bookmark count pill that opens a
 * full-screen overlay listing each saved āyah with its Arabic text, and a
 * separate Sign-out pill. Signed-out users see a plain Sign-in pill.
 * Hidden entirely when QF auth isn't configured.
 */
export function SignInWidget() {
  const refresh = useUser((s) => s.refresh);
  const status = useUser((s) => s.status);
  const bookmarks = useUser((s) => s.bookmarks);
  const signIn = useUser((s) => s.signIn);
  const signOut = useUser((s) => s.signOut);
  const remove = useUser((s) => s.remove);
  const graph = useGraphStore((s) => s.graph);
  const setSelected = useGraphStore((s) => s.setSelectedNode);

  const [open, setOpen] = useState(false);
  const t = useT();

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    // Prevent background scroll while overlay is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (status === "unknown" || status === "not_configured") return null;

  const pillClass = `flex h-8 items-center rounded-full border border-hairline bg-surface/40 px-3 text-[11px] uppercase tracking-[0.22em] text-text-muted transition hover:border-hairline-strong hover:text-ink-bright ${
    t.isRTL ? "font-arabic" : "font-sans"
  }`;

  if (status !== "signed_in") {
    return (
      <button onClick={() => signIn()} className={pillClass}>
        <span className="text-ink-bright">{t.signIn}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setOpen(true)}
        className={`${pillClass} gap-2`}
      >
        <BookmarkIcon filled={bookmarks.length > 0} />
        <span className="text-ink-bright">{bookmarks.length}</span>
      </button>

      <button onClick={signOut} className={pillClass}>
        {t.signOut}
      </button>

      {open && (
        <BookmarksOverlay
          bookmarks={bookmarks}
          graph={graph}
          onClose={() => setOpen(false)}
          onJump={(verseKey) => {
            setSelected(verseKey);
            setOpen(false);
          }}
          onRemove={(verseKey) => remove(verseKey)}
        />
      )}
    </div>
  );
}

/* ------------------------------- Overlay -------------------------------- */

function BookmarksOverlay({
  bookmarks,
  graph,
  onClose,
  onJump,
  onRemove,
}: {
  bookmarks: { id: string; verseKey: string }[];
  graph: GraphData | null;
  onClose: () => void;
  onJump: (verseKey: string) => void;
  onRemove: (verseKey: string) => void;
}) {
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.bookmarksAria}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ocean-deep/30 px-4 py-16"
      onClick={onClose}
    >
      <div
        className="rise relative w-full max-w-[480px] rounded-2xl border border-hairline bg-ocean-deep/85 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.75)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-hairline px-6 pb-4 pt-5">
          <div className="flex flex-col gap-1">
            <span className={`text-[10px] uppercase tracking-[0.3em] text-text-faint ${sansForLang}`}>
              {t.bookmarksEyebrow}
            </span>
            <h2 className={`text-[18px] font-medium tracking-tight text-text ${sansForLang}`}>
              {bookmarks.length === 0 ? t.bookmarksTitleEmpty : t.bookmarksTitleCount(bookmarks.length)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-text-muted transition hover:border-hairline-strong hover:text-text"
            aria-label={t.drawerClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="thin-scroll max-h-[65vh] overflow-y-auto px-6 py-4">
          {bookmarks.length === 0 ? (
            <p className={`py-16 text-center text-[13px] text-text-faint ${sansForLang}`}>
              {t.bookmarksEmptyHint}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {bookmarks.map((b) => (
                <li key={b.id}>
                  <BookmarkCard
                    verseKey={b.verseKey}
                    node={graph?.nodes[b.verseKey]}
                    onJump={() => onJump(b.verseKey)}
                    onRemove={() => onRemove(b.verseKey)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BookmarkCard({
  verseKey,
  node,
  onJump,
  onRemove,
}: {
  verseKey: string;
  node: GraphData["nodes"][string] | undefined;
  onJump: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const sansForLang = t.isRTL ? "font-arabic" : "font-sans";
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-hairline bg-surface/40 px-4 py-3 transition hover:border-hairline-strong hover:bg-surface/70">
      <button onClick={onJump} className={`flex-1 ${t.isRTL ? "text-right" : "text-left"}`}>
        <div className="flex items-center gap-2">
          <span className="font-sans text-[11.5px] tracking-wider text-ink">{verseKey}</span>
          {node && (
            <span className={`text-[10.5px] text-text-faint ${sansForLang}`}>· {node.sn}</span>
          )}
        </div>
        {node ? (
          <p
            className="mt-2 line-clamp-2 text-right font-quran text-[17px] leading-[1.85] text-text group-hover:text-ink-bright"
            dir="rtl"
            lang="ar"
          >
            {node.t}
          </p>
        ) : (
          <p className={`mt-2 text-[11.5px] text-text-faint ${sansForLang}`}>
            {t.bookmarksVerseUnavailable}
          </p>
        )}
      </button>
      <button
        onClick={onRemove}
        title={t.bookmarksRemove}
        aria-label={t.bookmarksRemove}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline text-text-faint opacity-0 transition group-hover:opacity-100 hover:border-hairline-strong hover:text-text"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill={filled ? "currentColor" : "none"}>
      <path
        d="M1 1.5C1 1.22 1.22 1 1.5 1h7c.28 0 .5.22.5.5v9.7c0 .4-.45.62-.77.38L5 9 1.77 11.58A.5.5 0 0 1 1 11.18V1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
