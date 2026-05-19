"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/user/store";
import { useGraphStore } from "@/lib/store";

/**
 * Header chip that:
 *   - shows total saved count for everyone (local + cloud both feed it)
 *   - opens a popover with the bookmark list and a click-to-jump action
 *   - exposes Sign in / Sign out when QF user-auth is configured
 *
 * Bookmarks always work locally; signing in promotes them to cloud sync.
 */
export function SignInWidget() {
  const refresh = useUser((s) => s.refresh);
  const status = useUser((s) => s.status);
  const configured = useUser((s) => s.configured);
  const bookmarks = useUser((s) => s.bookmarks);
  const signIn = useUser((s) => s.signIn);
  const signOut = useUser((s) => s.signOut);
  const remove = useUser((s) => s.remove);
  const setSelected = useGraphStore((s) => s.setSelectedNode);

  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Close popover on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "unknown") return null;

  const synced = status === "signed_in";
  const totalLabel = synced ? "Synced" : "Saved";

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-2 rounded-full border border-hairline bg-surface/40 px-3 font-sans text-[11px] uppercase tracking-[0.22em] text-text-muted transition hover:border-hairline-strong hover:text-ink-bright"
      >
        <BookmarkIcon filled={bookmarks.length > 0} />
        <span className="text-ink-bright">{bookmarks.length}</span>
        <span className="text-text-faint">{totalLabel}</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[340px] overflow-hidden rounded-xl border border-hairline-strong bg-ocean-deep/95 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl rise"
        >
          <div className="border-b border-hairline px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-sans text-[10.5px] uppercase tracking-[0.32em] text-text-faint">
                  Your saved āyāt
                </div>
                <div className="mt-0.5 font-sans text-[13px] text-text">
                  {bookmarks.length === 0
                    ? "Nothing saved yet"
                    : `${bookmarks.length} bookmark${bookmarks.length === 1 ? "" : "s"}`}
                </div>
              </div>
              {synced ? (
                <button
                  onClick={signOut}
                  className="font-sans text-[10.5px] uppercase tracking-[0.2em] text-text-faint transition hover:text-text"
                >
                  Sign out
                </button>
              ) : configured ? (
                <button
                  onClick={() => signIn()}
                  className="font-sans text-[10.5px] uppercase tracking-[0.22em] text-ink transition hover:text-ink-bright"
                >
                  Sign in
                </button>
              ) : null}
            </div>
            {!synced && (
              <div className="mt-2 rounded-md border border-hairline bg-surface/40 px-2.5 py-1.5 font-sans text-[10.5px] leading-[1.5] text-text-muted">
                Saved on this device only.{" "}
                {configured
                  ? "Sign in to sync across devices."
                  : "Configure Quran.Foundation credentials to enable cloud sync."}
              </div>
            )}
          </div>

          <div className="thin-scroll max-h-[60vh] overflow-y-auto">
            {bookmarks.length === 0 ? (
              <p className="px-4 py-8 text-center font-sans text-[12.5px] text-text-faint">
                Open any āyah and tap the bookmark to save it here.
              </p>
            ) : (
              <ul>
                {bookmarks.map((b) => (
                  <li key={b.id} className="border-t border-hairline first:border-t-0">
                    <div className="group flex items-center gap-3 px-4 py-2.5">
                      <button
                        onClick={() => {
                          setSelected(b.verseKey);
                          setOpen(false);
                        }}
                        className="flex-1 text-left"
                      >
                        <span className="font-sans text-[12px] tracking-wider text-ink">
                          {b.verseKey}
                        </span>
                        <span className="ml-2 font-sans text-[11px] text-text-faint">
                          jump to graph
                        </span>
                      </button>
                      <button
                        onClick={() => remove(b.verseKey)}
                        title="Remove"
                        className="opacity-0 transition group-hover:opacity-100"
                        aria-label="Remove bookmark"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
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
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
