"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { GraphData } from "@/types/graph";
import type { Layout } from "@/lib/layout";
import { CATEGORY_COLOR } from "@/types/graph";
import { useGraphStore } from "@/lib/store";

type Props = { graph: GraphData; layout: Layout };

const SEGMENTS = 6; // bezier resolution per edge

/**
 * Renders all edges as a single LineSegments object — one draw call.
 * Highlighted edges (connections of the focused node) are drawn as a
 * second, brighter overlay so we don't need to mutate the bulk geometry.
 */
export function Edges({ graph, layout }: Props) {
  const baseRef = useRef<THREE.LineSegments>(null);
  const highlightRef = useRef<THREE.LineSegments>(null);
  const baseMatRef = useRef<THREE.LineBasicMaterial>(null);

  const baseGeom = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const pulseSeed: number[] = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const mid = new THREE.Vector3();

    graph.edges.forEach((edge, ei) => {
      const pa = layout.positions[edge.a];
      const pb = layout.positions[edge.b];
      if (!pa || !pb) return;
      a.set(pa.x, pa.y, pa.z);
      b.set(pb.x, pb.y, pb.z);
      // Pull midpoint toward the origin so edges curve inward like ink threads
      // diffusing through water — keeps the visual core dense instead of a hairball shell.
      mid.copy(a).add(b).multiplyScalar(0.5).multiplyScalar(0.78);

      const col = new THREE.Color(CATEGORY_COLOR[edge.pc] ?? "#d4af37");
      // Slightly tint by opinion count so multi-source edges read warmer.
      col.lerp(new THREE.Color("#f5d97a"), Math.min(edge.w / 6, 0.5) * 0.4);

      for (let s = 0; s < SEGMENTS; s++) {
        const t0 = s / SEGMENTS;
        const t1 = (s + 1) / SEGMENTS;
        const p0 = quadBezier(a, mid, b, t0);
        const p1 = quadBezier(a, mid, b, t1);
        positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
        pulseSeed.push(ei + t0, ei + t1);
      }
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.setAttribute("seed", new THREE.Float32BufferAttribute(pulseSeed, 1));
    return g;
  }, [graph, layout]);

  // Highlight geometry — re-built when selection / hover changes.
  const highlightGeom = useMemo(() => new THREE.BufferGeometry(), []);

  useEffect(() => {
    return useGraphStore.subscribe((state, prev) => {
      const focus = state.selectedNode ?? state.hoveredNode;
      const prevFocus = prev.selectedNode ?? prev.hoveredNode;
      if (focus === prevFocus) return;
      rebuildHighlight(highlightGeom, graph, layout, focus);
    });
  }, [graph, layout, highlightGeom]);

  // Initial highlight build.
  useEffect(() => {
    const focus = useGraphStore.getState().selectedNode ?? useGraphStore.getState().hoveredNode;
    rebuildHighlight(highlightGeom, graph, layout, focus);
  }, [graph, layout, highlightGeom]);

  // React to category filters by attenuating the base material opacity.
  useFrame((_, dt) => {
    const mat = baseMatRef.current;
    if (!mat) return;
    const { activeCategories, selectedNode, hoveredNode } = useGraphStore.getState();
    const hasFilter = activeCategories.size > 0;
    const hasFocus = !!(selectedNode || hoveredNode);
    const target = hasFocus ? 0.07 : hasFilter ? 0.05 : 0.22;
    mat.opacity += (target - mat.opacity) * Math.min(dt * 4, 1);
  });

  return (
    <group>
      <lineSegments ref={baseRef} geometry={baseGeom} renderOrder={-1}>
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
      <lineSegments ref={highlightRef} geometry={highlightGeom}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          linewidth={2}
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

function rebuildHighlight(
  geom: THREE.BufferGeometry,
  graph: GraphData,
  layout: Layout,
  focusId: string | null,
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

  for (const ei of graph.nodes[focusId].e) {
    const edge = graph.edges[ei];
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
