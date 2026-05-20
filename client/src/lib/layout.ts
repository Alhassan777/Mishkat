import * as THREE from "three";
import type { Category, GraphData, Node } from "@/types/graph";
import { CATEGORY_COLOR } from "@/types/graph";

/**
 * Spatial layout for the mutashābihāt graph.
 *
 * Two modes:
 *  - Default (no filter): cluster by surah on a Fibonacci sphere. Each surah's
 *    āyāt scatter in a small disc tangent to the sphere surface — the "currents
 *    within the sea" image from the design doc.
 *  - Filtered (one or more categories active): cluster by the connected
 *    components of the subgraph induced by the active-category edges. Isolated
 *    nodes (no matching edge) recede to a faint outer ring.
 *
 * Switching modes triggers an animated re-layout in Scene.tsx — that's what
 * gives the "click a category and watch clusters reshape" behavior.
 */

const SPHERE_RADIUS = 28;
const ISOLATE_RADIUS = 52;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type NodePosition = { x: number; y: number; z: number };

export type Cluster = {
  id: string;
  position: NodePosition;
  size: number;
  /** Approximate spread of the cluster (used for halo sizing). */
  radius: number;
  /** Member node ids. */
  members: string[];
  /** Color hint (hex). */
  color: string;
  /** Optional label (surah name in default mode). */
  label?: string;
};

export type Layout = {
  positions: Record<string, NodePosition>;
  clusters: Cluster[];
};

function fibSpherePoint(i: number, n: number, radius: number): NodePosition {
  if (n <= 1) return { x: 0, y: 0, z: 0 };
  const y = 1 - (i / (n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = GOLDEN_ANGLE * i;
  return {
    x: Math.cos(theta) * r * radius,
    y: y * radius,
    z: Math.sin(theta) * r * radius,
  };
}

function rand(seed: number): number {
  const x = Math.sin(seed * 9999.1) * 43758.5453;
  return x - Math.floor(x);
}

function scatterInDisc(
  members: { id: string; node: Node }[],
  centroid: NodePosition,
  radius: number,
  positions: Record<string, NodePosition>,
) {
  const normal = new THREE.Vector3(centroid.x, centroid.y, centroid.z);
  if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1);
  normal.normalize();
  const ref =
    Math.abs(normal.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3().crossVectors(normal, ref).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

  const count = members.length;
  members.forEach((entry, j) => {
    const t = j / Math.max(count - 1, 1);
    const angle = j * GOLDEN_ANGLE;
    const r = radius * Math.sqrt(t);
    const wobble = (rand(entry.node.n || j + 1) - 0.5) * 0.5;

    positions[entry.id] = {
      x:
        centroid.x +
        Math.cos(angle) * r * tangent.x +
        Math.sin(angle) * r * bitangent.x +
        wobble * normal.x,
      y:
        centroid.y +
        Math.cos(angle) * r * tangent.y +
        Math.sin(angle) * r * bitangent.y +
        wobble * normal.y,
      z:
        centroid.z +
        Math.cos(angle) * r * tangent.z +
        Math.sin(angle) * r * bitangent.z +
        wobble * normal.z,
    };
  });
}

function buildSurahLayout(graph: GraphData): Layout {
  const bySurah = new Map<number, { id: string; node: Node }[]>();
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (!bySurah.has(node.s)) bySurah.set(node.s, []);
    bySurah.get(node.s)!.push({ id, node });
  }
  for (const arr of bySurah.values()) arr.sort((x, y) => x.node.a - y.node.a);

  const surahs = [...bySurah.keys()].sort((a, b) => a - b);
  const n = surahs.length;

  const positions: Record<string, NodePosition> = {};
  const clusters: Cluster[] = [];

  surahs.forEach((surah, i) => {
    const centroid = fibSpherePoint(i, n, SPHERE_RADIUS);
    const group = bySurah.get(surah)!;
    const radius = Math.min(2 + Math.log2(group.length + 1) * 0.9, 7);
    scatterInDisc(group, centroid, radius, positions);
    clusters.push({
      id: `surah-${surah}`,
      position: centroid,
      size: group.length,
      radius,
      members: group.map((e) => e.id),
      label: group[0].node.sn,
      color: "#d4af37",
    });
  });

  return { positions, clusters };
}

function buildCategoryLayout(graph: GraphData, active: Set<Category>): Layout {
  // 1. Adjacency restricted to active-category edges.
  const adj = new Map<string, string[]>();
  for (const id of Object.keys(graph.nodes)) adj.set(id, []);
  for (const edge of graph.edges) {
    if (!active.has(edge.pc)) continue;
    adj.get(edge.a)!.push(edge.b);
    adj.get(edge.b)!.push(edge.a);
  }

  // 2. Connected components (only nodes with at least one matching edge).
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const [id, neighbors] of adj) {
    if (visited.has(id) || neighbors.length === 0) continue;
    const stack = [id];
    visited.add(id);
    const comp: string[] = [];
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const nbr of adj.get(cur)!) {
        if (!visited.has(nbr)) {
          visited.add(nbr);
          stack.push(nbr);
        }
      }
    }
    components.push(comp);
  }

  // Largest clusters get prime real estate.
  components.sort((a, b) => b.length - a.length);

  const positions: Record<string, NodePosition> = {};
  const clusters: Cluster[] = [];

  const N = components.length;
  // Centroid sphere radius scales with cluster count so they don't crowd.
  const centroidR = N <= 1 ? 0 : N <= 4 ? 12 : N <= 12 ? 20 : N <= 30 ? 26 : 30;

  // Color picks the first active category — when multiple are on, we color by
  // each node's dominant matching category in Scene.tsx; the cluster halo uses
  // the first as a coarse hint.
  const activeArr = Array.from(active);
  const haloColor = CATEGORY_COLOR[activeArr[0]] ?? "#d4af37";

  components.forEach((comp, i) => {
    const centroid = fibSpherePoint(i, N, centroidR);
    const radius = Math.min(2 + Math.log2(comp.length + 1) * 1.15, 9);
    const members = comp
      .map((id) => ({ id, node: graph.nodes[id] }))
      .sort((a, b) => a.node.s - b.node.s || a.node.a - b.node.a);
    scatterInDisc(members, centroid, radius, positions);
    clusters.push({
      id: `cc-${i}`,
      position: centroid,
      size: comp.length,
      radius,
      members: comp,
      color: haloColor,
    });
  });

  // 3. Isolates → faint outer ring at large radius. We still position them so
  //    they fade out gracefully rather than vanishing.
  const isolates: { id: string; node: Node }[] = [];
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (!visited.has(id)) isolates.push({ id, node });
  }
  isolates.sort((a, b) => a.node.n - b.node.n);
  const M = Math.max(isolates.length, 2);
  isolates.forEach((entry, i) => {
    positions[entry.id] = fibSpherePoint(i, M, ISOLATE_RADIUS);
  });

  return { positions, clusters };
}

export function buildLayout(
  graph: GraphData,
  activeCategories: Set<Category> = new Set(),
): Layout {
  if (activeCategories.size === 0) return buildSurahLayout(graph);
  return buildCategoryLayout(graph, activeCategories);
}

export { SPHERE_RADIUS };
