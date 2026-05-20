"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { tafsirIdToKey, type TafsirKey } from "@/lib/quran/tafsirs";

/**
 * User preferences for the Quran.com enrichments. Persisted to localStorage
 * so the next visit honors the same translation / tafsīr / reciter choice.
 *
 * Defaults are well-known Quran.com resource IDs that exist in the public
 * catalog. If they don't (older account, regional restriction), the
 * settings popover will list whatever the API returns and the user can
 * pick a different one.
 */
type SettingsState = {
  translationId: number;
  /** Stable identifier — the concrete API id is resolved per UI language. */
  tafsirKey: TafsirKey;
  reciterId: number;
  /** When true, render word-by-word tokens with hover meanings. */
  showWordByWord: boolean;
  /** When true, render the translation under each Arabic verse. */
  showTranslation: boolean;
  /** When true, render the tafsīr panel in the node drawer. */
  showTafsir: boolean;

  set: <K extends keyof Omit<SettingsState, "set">>(key: K, value: SettingsState[K]) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      translationId: 20, // Saheeh International — English
      tafsirKey: "ibn-kathir",
      reciterId: 7, // Mishari Rashid al-`Afasy
      showWordByWord: true,
      showTranslation: true,
      showTafsir: true,
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
    }),
    {
      name: "ayat-settings",
      version: 3,
      migrate: (state, fromVersion) => {
        const s = state as Partial<SettingsState> & { tafsirId?: number };
        // v1 used translationId 131 which doesn't exist in this account's
        // catalog; remap stale values to the verified Saheeh International id.
        if (fromVersion < 2 && s.translationId === 131) s.translationId = 20;
        // v2 → v3: stored an opaque tafsīr id; convert to a stable key so
        // we can pick the right language edition per UI language.
        if (fromVersion < 3 && s.tafsirKey == null) {
          s.tafsirKey = tafsirIdToKey(s.tafsirId);
          delete s.tafsirId;
        }
        return s as SettingsState;
      },
    },
  ),
);
