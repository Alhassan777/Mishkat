"use client";

import { useEffect, useState } from "react";
import { fetchVerse, type QuranEnrichment, type VerseFetchOptions } from "./client";

/**
 * Subscribe to a single verse enrichment. Resolves through the in-memory
 * cache in client.ts so multiple components mounting the same ayah share
 * one request.
 */
export function useVerse(key: string | null, opts: VerseFetchOptions): QuranEnrichment | null {
  const [state, setState] = useState<QuranEnrichment | null>(null);

  useEffect(() => {
    if (!key) {
      setState(null);
      return;
    }
    setState(null);
    let cancelled = false;
    fetchVerse(key, opts).then((r) => {
      if (!cancelled) setState(r);
    });
    return () => {
      cancelled = true;
    };
  }, [key, opts.words, opts.translation, opts.tafsir, opts.reciter]);

  return state;
}
