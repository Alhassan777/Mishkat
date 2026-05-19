"use client";

import { create } from "zustand";
import type { Category, GraphData } from "@/types/graph";

type State = {
  graph: GraphData | null;
  setGraph: (g: GraphData) => void;

  /** Hovered / focused node id ("s:a"). */
  hoveredNode: string | null;
  setHoveredNode: (id: string | null) => void;

  /** The node whose detail/connections drawer is open. */
  selectedNode: string | null;
  setSelectedNode: (id: string | null) => void;

  /** The edge currently open in the comparison view ([nodeA, nodeB]). */
  selectedEdge: [string, string] | null;
  setSelectedEdge: (pair: [string, string] | null) => void;

  /** Active category filters. Empty set = show all. */
  activeCategories: Set<Category>;
  toggleCategory: (c: Category) => void;
  clearCategories: () => void;
};

export const useGraphStore = create<State>((set) => ({
  graph: null,
  setGraph: (g) => set({ graph: g }),

  hoveredNode: null,
  setHoveredNode: (id) => set({ hoveredNode: id }),

  selectedNode: null,
  setSelectedNode: (id) => set({ selectedNode: id, selectedEdge: null }),

  selectedEdge: null,
  setSelectedEdge: (pair) => set({ selectedEdge: pair }),

  activeCategories: new Set(),
  toggleCategory: (c) =>
    set((s) => {
      const next = new Set(s.activeCategories);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return { activeCategories: next };
    }),
  clearCategories: () => set({ activeCategories: new Set() }),
}));
