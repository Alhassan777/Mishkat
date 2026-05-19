"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Category, GraphData } from "@/types/graph";
import type { Layout } from "@/lib/layout";
import { CATEGORY_COLOR } from "@/types/graph";
import { useGraphStore } from "@/lib/store";

type Props = { graph: GraphData; layout: Layout };

const SEGMENTS = 6; // bezier resolution per edge
const VERTS_PER_EDGE = SEGMENTS * 2; // LineSegments → 2 verts per segment

/**
 * All edges live in a single LineSegments object (one draw call).
 *
 * Category filtering ("the lens") works by zeroing the per-vertex color of
 * any edge whose dominant category is not in the active set. Because the
 * material uses additive blending, a black vertex contributes nothing —
 * filtered edges visibly disappear without ever rebuilding geometry.
 *
 * Selecting / hovering a node draws a brighter overlay LineSegments on top.
 */
export function Edges({ graph, layout }: Props) {
  const baseMatRef = useRef<THREE.LineBasicMaterial>(null);

  // Build geometry once. Keep originalColors + per-edge category so we can
  // rewrite the color buffer cheaply when the lens changes.
  const { baseGeom, originalColors, edgeCategories } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const cats: Category[] = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const mid = new THREE.Vector3();

    graph.edges.forEach((edge) => {
      const pa = layout.positions[edge.a];
      const pb = layout.positions[edge.b];
      if (!pa || !pb) return;
      a.set(pa.x, pa.y, pa.z);
      b.set(pb.x, pb.y, pb.z);
      // Pull midpoint inward so threads curve toward the heart of the sea.
      mid.copy(a).add(b).multiplyScalar(0.5).multiplyScalar(0.78);

      const col = new THREE.Color(CATEGORY_COLOR[edge.pc] ?? "#d4af37");
      // Multi-source edges read warmer.
      col.lerp(new THREE.Color("#f5d97a"), Math.min(edge.w / 6, 0.5) * 0.4);

      for (let s = 0; s < SEGMENTS; s++) {
        const t0 = s / SEGMENTS;
        const t1 = (s + 1) / SEGMENTS;
        const p0 = quadBezier(a, mid, b, t0);
        const p1 = quadBezier(a, mid, b, t1);
        positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
      }
      cats.push(edge.pc);
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors.slice(), 3));

    return {
      baseGeom: g,
      originalColors: new Float32Array(colors),
      edgeCategories: cats,
    };
  }, [graph, layout]);

  const highlightGeom = useMemo(() => new THREE.BufferGeometry(), []);

  // Apply the lens — rewrite the color buffer when active categories change.
  useEffect(() => {
    applyLens(baseGeom, originalColors, edgeCategories, useGraphStore.getState().activeCategories);

    return useGraphStore.subscribe((state, prev) => {
      if (state.activeCategories !== prev.activeCategories) {
        applyLens(baseGeom, originalColors, edgeCategories, state.activeCategories);
      }
    });
  }, [baseGeom, originalColors, edgeCategories]);

  // Highlight overlay tracks focus (selected ?? hovered) AND the active lens.
  // Threads outside the lens stay hidden even when their endpoint is focused.
  useEffect(() => {
    const apply = () => {
      const s = useGraphStore.getState();
      rebuildHighlight(
        highlightGeom,
        graph,
        layout,
        s.selectedNode ?? s.hoveredNode,
        s.activeCategories,
      );
    };
    apply();
    return useGraphStore.subscribe((state, prev) => {
      const focus = state.selectedNode ?? state.hoveredNode;
      const prevFocus = prev.selectedNode ?? prev.hoveredNode;
      if (focus !== prevFocus || state.activeCategories !== prev.activeCategories) apply();
    });
  }, [graph, layout, highlightGeom]);

  // Smooth base opacity by mode. Filter-on raises the floor (the surviving
  // edges become the point of the scene); focus drops it (highlight takes over).
  useFrame((_, dt) => {
    const mat = baseMatRef.current;
    if (!mat) return;
    const { activeCategories, selectedNode, hoveredNode } = useGraphStore.getState();
    const hasFilter = activeCategories.size > 0;
    const hasFocus = !!(selectedNode || hoveredNode);
    const target = hasFilter ? (hasFocus ? 0.55 : 0.7) : hasFocus ? 0.07 : 0.22;
    mat.opacity += (target - mat.opacity) * Math.min(dt * 4, 1);
  });

  return (
    <group>
      <lineSegments geometry={baseGeom} renderOrder={-1}>
        <lineBasicMaterial
          ref={baseMatRef}
          vertexColors
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>
      <lineSegments geometry={highlightGeom}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  );
}

function quadBezier(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, t: number) {
  const u = 1 - t;
  return new THREE.Vector3(
    u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z,
  );
}

/**
 * Zero the color of any edge whose category isn't in the active set.
 * Empty set ⇒ show all. Additive blending makes (0,0,0) invisible.
 */
function applyLens(
  geom: THREE.BufferGeometry,
  originalColors: Float32Array,
  edgeCategories: Category[],
  active: Set<Category>,
) {
  const colorAttr = geom.getAttribute("color") as THREE.BufferAttribute;
  const arr = colorAttr.array as Float32Array;
  const stride = VERTS_PER_EDGE * 3; // floats per edge

  for (let ei = 0; ei < edgeCategories.length; ei++) {
    const offset = ei * stride;
    const visible = active.size === 0 || active.has(edgeCategories[ei]);
    if (visible) {
      // Copy from original.
      for (let k = 0; k < stride; k++) arr[offset + k] = originalColors[offset + k];
    } else {
      // Effectively invisible under additive blending.
      for (let k = 0; k < stride; k++) arr[offset + k] = 0;
    }
  }
  colorAttr.needsUpdate = true;
}

function rebuildHighlight(
  geom: THREE.BufferGeometry,
  graph: GraphData,
  layout: Layout,
  focusId: string | null,
  activeCategories: Set<Category>,
) {
  if (!focusId || !graph.nodes[focusId]) {
    geom.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
    geom.setAttribute("color", new THREE.Float32BufferAttribute([], 3));
    return;
  }
  const positions: number[] = [];
  const colors: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const hasFilter = activeCategories.size > 0;

  for (const ei of graph.nodes[focusId].e) {
    const edge = graph.edges[ei];
    if (hasFilter && !activeCategories.has(edge.pc)) continue;
    const pa = layout.positions[edge.a];
    const pb = layout.positions[edge.b];
    if (!pa || !pb) continue;
    a.set(pa.x, pa.y, pa.z);
    b.set(pb.x, pb.y, pb.z);
    mid.copy(a).add(b).multiplyScalar(0.5).multiplyScalar(0.78);

    const base = new THREE.Color(CATEGORY_COLOR[edge.pc] ?? "#d4af37");
    base.lerp(new THREE.Color("#fff1b8"), 0.45);

    for (let s = 0; s < SEGMENTS; s++) {
      const t0 = s / SEGMENTS;
      const t1 = (s + 1) / SEGMENTS;
      const p0 = quadBezier(a, mid, b, t0);
      const p1 = quadBezier(a, mid, b, t1);
      positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      colors.push(base.r, base.g, base.b, base.r, base.g, base.b);
    }
  }
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
}
