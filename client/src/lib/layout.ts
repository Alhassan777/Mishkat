import * as THREE from "three";
import type { GraphData, Node } from "@/types/graph";

/**
 * Spatial layout for the mutashābihāt graph.
 *
 * Surahs become "gravitational centers" placed on a Fibonacci sphere (so
 * neighboring surahs in the mushaf land near each other on the sphere
 * surface). Each surah's ayāt are scattered around its anchor with a small
 * radius proportional to log(node count) — denser surahs occupy slightly
 * more volume, mirroring the design doc's "currents within the sea".
 *
 * Output positions are in world units; the camera frames a sphere of
 * radius ~SPHERE_RADIUS.
 */

const SPHERE_RADIUS = 28;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type NodePosition = { x: number; y: number; z: number };
export type SurahAnchor = {
  surah: number;
  name: string;
  position: NodePosition;
  count: number;
  radius: number;
};

export type Layout = {
  positions: Record<string, NodePosition>;
  anchors: SurahAnchor[];
};

function fibonacciSpherePoint(i: number, n: number, radius: number): NodePosition {
  // i in [0, n)
  const y = 1 - (i / (n - 1)) * 2; // -1 .. 1
  const r = Math.sqrt(1 - y * y);
  const theta = GOLDEN_ANGLE * i;
  return {
    x: Math.cos(theta) * r * radius,
    y: y * radius,
    z: Math.sin(theta) * r * radius,
  };
}

/** Deterministic pseudo-random in [0,1) seeded by an integer. */
function rand(seed: number): number {
  const x = Math.sin(seed * 9999.1) * 43758.5453;
  return x - Math.floor(x);
}

export function buildLayout(graph: GraphData): Layout {
  // 1. Group node ids by surah, retain order by ayah.
  const bySurah = new Map<number, { id: string; node: Node }[]>();
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (!bySurah.has(node.s)) bySurah.set(node.s, []);
    bySurah.get(node.s)!.push({ id, node });
  }
  for (const arr of bySurah.values()) arr.sort((x, y) => x.node.a - y.node.a);

  const surahs = [...bySurah.keys()].sort((a, b) => a - b);
  const n = surahs.length;

  const anchors: SurahAnchor[] = [];
  const positions: Record<string, NodePosition> = {};

  surahs.forEach((surah, i) => {
    const anchor = fibonacciSpherePoint(i, n, SPHERE_RADIUS);
    const group = bySurah.get(surah)!;
    const count = group.length;
    // Cluster radius scales gently with node count; capped so big surahs don't swallow the scene.
    const clusterRadius = Math.min(2 + Math.log2(count + 1) * 0.9, 7);

    anchors.push({
      surah,
      name: group[0].node.sn,
      position: anchor,
      count,
      radius: clusterRadius,
    });

    // Local frame: build a tangent basis at the anchor so the cluster lays
    // out as a small flattened disc tangent to the sphere — cleaner than
    // pure 3D scatter and far more legible from any orbit angle.
    const normal = new THREE.Vector3(anchor.x, anchor.y, anchor.z).normalize();
    const ref = Math.abs(normal.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3().crossVectors(normal, ref).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    group.forEach((entry, j) => {
      // Spiral inside the cluster disc, ordered by ayah number.
      const t = j / Math.max(count - 1, 1);
      const angle = j * GOLDEN_ANGLE;
      const r = clusterRadius * Math.sqrt(t);
      const wobble = (rand(entry.node.n) - 0.5) * 0.6;

      const local = new THREE.Vector3()
        .addScaledVector(tangent, Math.cos(angle) * r)
        .addScaledVector(bitangent, Math.sin(angle) * r)
        .addScaledVector(normal, wobble);

      positions[entry.id] = {
        x: anchor.x + local.x,
        y: anchor.y + local.y,
        z: anchor.z + local.z,
      };
    });
  });

  return { positions, anchors };
}

export { SPHERE_RADIUS };
