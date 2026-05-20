"use client";

import { create } from "zustand";

/**
 * Bookmarks live in Quran.Foundation's cloud and require sign-in. Signed-out
 * users see no bookmark surface at all — there is no local fallback.
 */

export type Bookmark = { id: string; verseKey: string };

type Status = "unknown" | "signed_in" | "signed_out" | "not_configured";

type UserState = {
  status: Status;
  configured: boolean;
  bookmarks: Bookmark[];
  saved: Set<string>;
  pending: Set<string>;

  refresh: () => Promise<void>;
  signIn: (returnTo?: string) => void;
  signOut: () => Promise<void>;
  add: (verseKey: string) => Promise<void>;
  remove: (verseKey: string) => Promise<void>;
};

function recompute(bookmarks: Bookmark[]): Set<string> {
  return new Set(bookmarks.map((b) => b.verseKey));
}

export const useUser = create<UserState>((set, get) => ({
  status: "unknown",
  configured: false,
  bookmarks: [],
  saved: new Set(),
  pending: new Set(),

  refresh: async () => {
    let me: { signedIn?: boolean; configured?: boolean } = {};
    try {
      const r = await fetch("/api/auth/me");
      me = await r.json();
    } catch {
      set({ status: "not_configured", configured: false, bookmarks: [], saved: new Set() });
      return;
    }

    if (!me.configured) {
      set({ status: "not_configured", configured: false, bookmarks: [], saved: new Set() });
      return;
    }
    if (!me.signedIn) {
      set({ status: "signed_out", configured: true, bookmarks: [], saved: new Set() });
      return;
    }
    set({ status: "signed_in", configured: true });
    try {
      const br = await fetch("/api/bookmarks");
      if (br.ok) {
        const j = (await br.json()) as { bookmarks: Bookmark[] };
        const list = j.bookmarks ?? [];
        set({ bookmarks: list, saved: recompute(list) });
      }
    } catch {
      /* swallow */
    }
  },

  signIn: (returnTo) => {
    const here = returnTo ?? (typeof window !== "undefined" ? window.location.pathname : "/");
    window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(here)}`;
  },

  signOut: async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    set({ status: "signed_out", bookmarks: [], saved: new Set() });
  },

  add: async (verseKey: string) => {
    const s = get();
    if (s.status !== "signed_in") return;
    if (s.saved.has(verseKey) || s.pending.has(verseKey)) return;

    const tempId = `tmp-${verseKey}`;
    const optimistic: Bookmark = { id: tempId, verseKey };
    const nextList = [optimistic, ...s.bookmarks];
    set({
      bookmarks: nextList,
      saved: recompute(nextList),
      pending: new Set([...s.pending, verseKey]),
    });
    try {
      const r = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ verseKey }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
      const real = (json.bookmark as Bookmark | undefined) ?? { id: tempId, verseKey };
      const merged = get().bookmarks.map((b) => (b.id === tempId ? real : b));
      const pending = new Set(get().pending);
      pending.delete(verseKey);
      set({ bookmarks: merged, saved: recompute(merged), pending });
    } catch (e) {
      const rolled = get().bookmarks.filter((b) => b.id !== tempId);
      const pending = new Set(get().pending);
      pending.delete(verseKey);
      set({ bookmarks: rolled, saved: recompute(rolled), pending });
      console.error("Bookmark add failed:", e);
    }
  },

  remove: async (verseKey: string) => {
    const s = get();
    if (s.status !== "signed_in") return;
    const existing = s.bookmarks.find((b) => b.verseKey === verseKey);
    if (!existing || s.pending.has(verseKey)) return;

    const snapshot = s.bookmarks;
    const next = snapshot.filter((b) => b.verseKey !== verseKey);
    set({
      bookmarks: next,
      saved: recompute(next),
      pending: new Set([...s.pending, verseKey]),
    });
    try {
      const r = await fetch(`/api/bookmarks/${encodeURIComponent(existing.id)}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const pending = new Set(get().pending);
      pending.delete(verseKey);
      set({ pending });
    } catch (e) {
      const pending = new Set(get().pending);
      pending.delete(verseKey);
      set({ bookmarks: snapshot, saved: recompute(snapshot), pending });
      console.error("Bookmark remove failed:", e);
    }
  },
}));
