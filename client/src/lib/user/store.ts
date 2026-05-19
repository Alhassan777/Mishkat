"use client";

import { create } from "zustand";

/**
 * Bookmark state with a local-first fallback.
 *
 * Source of truth depends on `status`:
 *   - signed_in     → Quran.Foundation cloud (synced across devices)
 *   - signed_out    → browser localStorage only (works offline, this device)
 *   - not_configured → same as signed_out (QF user creds missing)
 *
 * Save always works. Sign-in is an upgrade that lets bookmarks roam.
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

const LOCAL_KEY = "ayat-local-bookmarks-v1";

function recompute(bookmarks: Bookmark[]): Set<string> {
  return new Set(bookmarks.map((b) => b.verseKey));
}

function loadLocal(): Bookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Bookmark[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocal(bookmarks: Bookmark[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(bookmarks));
  } catch {
    /* Quota / disabled storage — silent. */
  }
}

function localId(verseKey: string): string {
  return `local-${verseKey}-${Date.now().toString(36)}`;
}

export const useUser = create<UserState>((set, get) => ({
  status: "unknown",
  configured: false,
  bookmarks: [],
  saved: new Set(),
  pending: new Set(),

  refresh: async () => {
    // Always seed local list first so the UI is instant.
    const local = loadLocal();
    set({ bookmarks: local, saved: recompute(local) });

    let me: { signedIn?: boolean; configured?: boolean } = {};
    try {
      const r = await fetch("/api/auth/me");
      me = await r.json();
    } catch {
      // Network failure: stay in local-only mode.
      set({ status: "not_configured", configured: false });
      return;
    }

    if (!me.configured) {
      set({ status: "not_configured", configured: false });
      return;
    }
    if (!me.signedIn) {
      set({ status: "signed_out", configured: true });
      return;
    }
    // Signed in — the cloud is source of truth, overriding local for display.
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
    // Drop back to local-only view of the device's bookmarks.
    const local = loadLocal();
    set({ status: "signed_out", bookmarks: local, saved: recompute(local) });
  },

  add: async (verseKey: string) => {
    const s = get();
    if (s.saved.has(verseKey) || s.pending.has(verseKey)) return;

    // Local mode: write to localStorage immediately, no network.
    if (s.status !== "signed_in") {
      const next = [{ id: localId(verseKey), verseKey }, ...s.bookmarks];
      saveLocal(next);
      set({ bookmarks: next, saved: recompute(next) });
      return;
    }

    // Signed-in: optimistic + remote.
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
    const existing = s.bookmarks.find((b) => b.verseKey === verseKey);
    if (!existing || s.pending.has(verseKey)) return;

    // Local mode: same — remove from storage immediately.
    if (s.status !== "signed_in") {
      const next = s.bookmarks.filter((b) => b.verseKey !== verseKey);
      saveLocal(next);
      set({ bookmarks: next, saved: recompute(next) });
      return;
    }

    // Signed-in: optimistic + remote.
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
