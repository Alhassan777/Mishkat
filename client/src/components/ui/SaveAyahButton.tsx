"use client";

import { useUser } from "@/lib/user/store";

export function SaveAyahButton({ verseKey }: { verseKey: string }) {
  const status = useUser((s) => s.status);
  const saved = useUser((s) => s.saved.has(verseKey));
  const pending = useUser((s) => s.pending.has(verseKey));
  const add = useUser((s) => s.add);
  const remove = useUser((s) => s.remove);
  const signIn = useUser((s) => s.signIn);

  // While bootstrapping, hide rather than flash.
  if (status === "unknown") return null;
  // QF not wired up — bookmarks aren't possible at all.
  if (status === "not_configured") return null;

  if (status !== "signed_in") {
    return (
      <button
        onClick={() => signIn()}
        title="Sign in to save"
        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-hairline bg-surface/40 px-2.5 font-sans text-[10.5px] uppercase tracking-[0.2em] text-text-muted transition hover:border-hairline-strong hover:text-ink-bright"
      >
        <BookmarkGlyph />
        Sign in to save
      </button>
    );
  }

  const onClick = () => (saved ? remove(verseKey) : add(verseKey));
  const label = saved ? "Saved" : "Save";

  return (
    <button
      onClick={onClick}
      disabled={pending}
      title={label}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 font-sans text-[10.5px] uppercase tracking-[0.2em] transition disabled:opacity-50 ${
        saved
          ? "border-hairline-strong bg-ink/[0.14] text-ink-bright"
          : "border-hairline bg-surface/40 text-text-muted hover:border-hairline-strong hover:text-ink-bright"
      }`}
    >
      <BookmarkGlyph filled={saved} />
      {label}
    </button>
  );
}

function BookmarkGlyph({ filled }: { filled?: boolean }) {
  return (
    <svg width="9" height="11" viewBox="0 0 10 12" fill={filled ? "currentColor" : "none"}>
      <path
        d="M1 1.5C1 1.22 1.22 1 1.5 1h7c.28 0 .5.22.5.5v9.7c0 .4-.45.62-.77.38L5 9 1.77 11.58A.5.5 0 0 1 1 11.18V1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
