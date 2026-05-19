"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { GraphData } from "@/types/graph";
import { useGraphStore } from "@/lib/store";
import { Header } from "./ui/Header";
import { SearchBar } from "./ui/SearchBar";
import { FilterRail } from "./ui/FilterRail";
import { DetailDrawer } from "./ui/DetailDrawer";

// The 3D scene needs window/WebGL; keep it strictly client-side.
const Scene = dynamic(
  () => import("./scene/Scene").then((m) => m.Scene),
  { ssr: false, loading: () => null },
);

export function AppShell() {
  const setGraph = useGraphStore((s) => s.setGraph);
  const graph = useGraphStore((s) => s.graph);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/graph.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load graph: ${r.status}`);
        return r.json();
      })
      .then((data: GraphData) => {
        if (!cancelled) setGraph(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [setGraph]);

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-ocean">
      {graph ? <Scene graph={graph} /> : null}

      <Header />
      <SearchBar />
      <FilterRail />
      <DetailDrawer />

      {!graph && !error && <LoadingVeil />}
      {error && <ErrorVeil message={error} />}
    </main>
  );
}

function LoadingVeil() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <span className="absolute inset-0 -m-6 rounded-full bg-ink/10 blur-2xl" />
        <span className="block h-2 w-2 animate-pulse rounded-full bg-ink shadow-[0_0_24px_4px_rgba(212,175,55,0.55)]" />
      </div>
      <div className="font-sans text-[11px] uppercase tracking-[0.4em] text-text-muted">
        Drawing the threads…
      </div>
    </div>
  );
}

function ErrorVeil({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center px-6">
      <div className="max-w-md rounded-xl border border-hairline-strong bg-surface/80 p-6 text-center backdrop-blur">
        <div className="font-sans text-[11px] uppercase tracking-[0.32em] text-text-faint">
          The sea is silent
        </div>
        <p className="mt-3 font-sans text-[13px] text-text-muted">{message}</p>
      </div>
    </div>
  );
}
