"use client";

import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import type { ForceGraphMethods } from "react-force-graph-3d";
import type { Category, GraphData } from "@/types/graph";
import { CATEGORY_COLOR } from "@/types/graph";
import { buildLayout, type Cluster } from "@/lib/layout";
import { useGraphStore } from "@/lib/store";

// react-force-graph-3d touches `window` at import time → must be client-only.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

type FGNode = {
  id: string;
  // Force-graph's initial pin (set once, never re-read after first tick).
  fx: number;
  fy: number;
  fz: number;
  // Animation state we control directly via group.position.
  cx: number;
  cy: number;
  cz: number;
  tx: number;
  ty: number;
  tz: number;
  scale: number;
  /** Categories this node participates in (across all its edges). */
  cats: Set<Category>;
  /** Count of edges per category. */
  catCounts: Map<Category, number>;
};

type FGLink = {
  source: string;
  target: string;
};

const COLOR_DIM = new THREE.Color("#3a2c0e");
const COLOR_BASE = new THREE.Color("#b8902a");
const COLOR_FOCUS = new THREE.Color("#fff1b8");
const COLOR_ISOLATE = new THREE.Color("#1a1a1a");

const SHARED_SPHERE = new THREE.SphereGeometry(1, 16, 16);
const SHARED_HALO = new THREE.SphereGeometry(1, 12, 12);

export function Scene({ graph }: { graph: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined);

  // Per-node visual handles, populated by nodeThreeObject.
  const visuals = useRef<
    Map<
      string,
      {
        group: THREE.Group;
        mesh: THREE.Mesh;
        halo: THREE.Mesh;
        meshMat: THREE.MeshStandardMaterial;
        haloMat: THREE.MeshBasicMaterial;
        baseColor: THREE.Color;
        scale: number;
        cats: Set<Category>;
        catCounts: Map<Category, number>;
      }
    >
  >(new Map());

  // --- Initial node/link data. We mutate cx/cy/cz and tx/ty/tz on these
  //     objects directly inside the RAF loop (animation state lives with the
  //     node so force-graph and our renderer stay in sync). React's compiler-
  //     era immutability lint rule doesn't fit this pattern, so we silence it
  //     at the mutation sites below.
  const data = useMemo(() => {
    const initialLayout = buildLayout(graph, new Set());
    const ids = Object.keys(graph.nodes);

    const nodes: FGNode[] = ids.map((id) => {
      const p = initialLayout.positions[id];
      const node = graph.nodes[id];
      const deg = node?.e.length ?? 0;
      const scale = 0.16 + Math.min(Math.log2(deg + 1) * 0.05, 0.26);

      const cats = new Set<Category>();
      const catCounts = new Map<Category, number>();
      for (const ei of node?.e ?? []) {
        const c = graph.edges[ei].pc;
        cats.add(c);
        catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
      }

      return {
        id,
        fx: p.x,
        fy: p.y,
        fz: p.z,
        cx: p.x,
        cy: p.y,
        cz: p.z,
        tx: p.x,
        ty: p.y,
        tz: p.z,
        scale,
        cats,
        catCounts,
      };
    });

    return { nodes, links: [] as FGLink[], initialClusters: initialLayout.clusters };
  }, [graph]);

  // --- Plain three.js side effects. ---
  // We intentionally mutate per-node animation state (cx/cy/cz/tx/ty/tz) on
  // the FGNode objects inside the RAF loop — that's how the animated re-layout
  // works. React Compiler's immutability rule doesn't fit this pattern.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const scene = fg.scene();
    const renderer = fg.renderer();

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene.background = new THREE.Color("#050a15");
    scene.fog = new THREE.FogExp2("#050a15", 0.008);

    // Lights.
    const amb = new THREE.AmbientLight("#a8c0ff", 0.32);
    const p1 = new THREE.PointLight("#f5d97a", 1.4);
    p1.position.set(40, 30, 40);
    const p2 = new THREE.PointLight("#3a6fc4", 0.6);
    p2.position.set(-30, -20, 20);
    scene.add(amb, p1, p2);

    // Sea (dust + far halo).
    const sea = buildSea();
    scene.add(sea.group);

    // Edges (base + highlight overlay).
    const edges = buildEdges(graph);
    scene.add(edges.group);

    // Cluster halos.
    const halos = buildClusterHalos();
    scene.add(halos.group);
    halos.setClusters(data.initialClusters);

    fg.cameraPosition({ x: 0, y: 6, z: 70 });

    const nodeById = new Map<string, FGNode>(data.nodes.map((n) => [n.id, n]));
    const getNodePos = (id: string): { x: number; y: number; z: number } => {
      const n = nodeById.get(id);
      return n ? { x: n.cx, y: n.cy, z: n.cz } : { x: 0, y: 0, z: 0 };
    };

    // Initial edge positions from current (= initial) node positions.
    edges.updatePositions(getNodePos);

    // --- Reactive store wiring. ---
    const colorTarget: { focus: string | null; neighbors: Set<string> } = {
      focus: null,
      neighbors: new Set(),
    };
    let layoutAnimating = false;

    const updateBaseColors = (active: Set<Category>) => {
      const hasFilter = active.size > 0;
      for (const node of data.nodes) {
        const v = visuals.current.get(node.id);
        if (!v) continue;
        applyBaseColor(v, node, active, hasFilter);
      }
    };

    const applyLayout = (active: Set<Category>) => {
      const layout = buildLayout(graph, active);
      // eslint-disable-next-line react-hooks/immutability
      for (const node of data.nodes) {
        const p = layout.positions[node.id];
        if (p) {
          node.tx = p.x;
          node.ty = p.y;
          node.tz = p.z;
        }
      }
      halos.setClusters(layout.clusters);
      updateBaseColors(active);
      edges.applyLens(active);
      layoutAnimating = true;
    };

    const applyHighlight = () => {
      const { hoveredNode, selectedNode, graph: g, activeCategories } = useGraphStore.getState();
      if (!g) return;
      const focus = selectedNode ?? hoveredNode;
      const neighbors = new Set<string>();
      if (focus && g.nodes[focus]) {
        for (const ei of g.nodes[focus].e) {
          const e = g.edges[ei];
          neighbors.add(e.a === focus ? e.b : e.a);
        }
      }
      colorTarget.focus = focus;
      colorTarget.neighbors = neighbors;
      edges.rebuildHighlight(focus, activeCategories, getNodePos);
    };

    applyLayout(useGraphStore.getState().activeCategories);
    applyHighlight();

    const unsub = useGraphStore.subscribe((state, prev) => {
      if (state.activeCategories !== prev.activeCategories) {
        applyLayout(state.activeCategories);
      }
      const focus = state.selectedNode ?? state.hoveredNode;
      const prevFocus = prev.selectedNode ?? prev.hoveredNode;
      if (focus !== prevFocus || state.activeCategories !== prev.activeCategories) {
        applyHighlight();
      }
    });

    // --- RAF loop: position lerp + edge rebuild + color lerp + sea drift. ---
    const tmp = new THREE.Color();
    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const dt = clock.getDelta();
      sea.tick(dt);
      halos.tick(dt);

      const state = useGraphStore.getState();
      const hasFilter = state.activeCategories.size > 0;
      const hasFocus = !!(state.selectedNode || state.hoveredNode);
      const target = hasFilter ? (hasFocus ? 0.55 : 0.7) : hasFocus ? 0.07 : 0.22;
      edges.baseMat.opacity += (target - edges.baseMat.opacity) * Math.min(dt * 4, 1);

      // Position lerp. We re-set group.position every frame (not only on delta)
      // because react-force-graph may overwrite obj.position internally on its
      // own render path.
      const posAlpha = Math.min(dt * 3.2, 1);
      let maxDelta = 0;
      for (const node of data.nodes) {
        const dx = node.tx - node.cx;
        const dy = node.ty - node.cy;
        const dz = node.tz - node.cz;
        if (dx !== 0 || dy !== 0 || dz !== 0) {
          node.cx += dx * posAlpha;
          node.cy += dy * posAlpha;
          node.cz += dz * posAlpha;
          const d = dx * dx + dy * dy + dz * dz;
          if (d > maxDelta) maxDelta = d;
        }
        const v = visuals.current.get(node.id);
        if (v) v.group.position.set(node.cx, node.cy, node.cz);
      }

      if (layoutAnimating) {
        edges.updatePositions(getNodePos);
        if (colorTarget.focus) {
          edges.rebuildHighlight(
            colorTarget.focus,
            state.activeCategories,
            getNodePos,
          );
        }
        if (maxDelta < 0.002) {
          // Snap to final to avoid tiny drift; stop animating.
          for (const node of data.nodes) {
            node.cx = node.tx;
            node.cy = node.ty;
            node.cz = node.tz;
            const v = visuals.current.get(node.id);
            if (v) v.group.position.set(node.cx, node.cy, node.cz);
          }
          edges.updatePositions(getNodePos);
          layoutAnimating = false;
        }
      }

      // Color lerp.
      const focus = colorTarget.focus;
      const neighbors = colorTarget.neighbors;
      for (const [id, v] of visuals.current) {
        let to: THREE.Color;
        if (id === focus) {
          to = COLOR_FOCUS;
        } else if (!focus) {
          to = v.baseColor;
        } else if (neighbors.has(id)) {
          tmp.copy(v.baseColor).lerp(COLOR_FOCUS, 0.55);
          to = tmp;
        } else {
          tmp.copy(v.baseColor).lerp(COLOR_DIM, 0.7);
          to = tmp;
        }
        v.meshMat.color.lerp(to, 0.18);
        v.meshMat.emissive.copy(v.meshMat.color).multiplyScalar(0.6);
        v.haloMat.color.copy(v.meshMat.color);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      unsub();
      scene.remove(amb, p1, p2, sea.group, edges.group, halos.group);
      sea.dispose();
      edges.dispose();
      halos.dispose();
    };
  }, [graph, data]);

  // Click-on-empty-space clears selection (handled below via onBackgroundClick;
  // this is just a hook safety net for future use).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onBg = () => {};
    el.addEventListener("pointerdown", onBg);
    return () => el.removeEventListener("pointerdown", onBg);
  }, []);

  // --- nodeThreeObject: build sphere + halo group for each node. ---
  const buildNodeObject = (raw: object) => {
    const n = raw as FGNode;
    const group = new THREE.Group();
    group.position.set(n.cx, n.cy, n.cz);
    const meshMat = new THREE.MeshStandardMaterial({
      color: COLOR_BASE.clone(),
      emissive: new THREE.Color("#d4af37"),
      emissiveIntensity: 0.45,
      metalness: 0.6,
      roughness: 0.25,
      toneMapped: false,
    });
    const haloMat = new THREE.MeshBasicMaterial({
      color: COLOR_BASE.clone(),
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(SHARED_SPHERE, meshMat);
    mesh.scale.setScalar(n.scale);
    const halo = new THREE.Mesh(SHARED_HALO, haloMat);
    halo.scale.setScalar(n.scale * 3.8);
    halo.raycast = () => {};
    group.add(halo, mesh);

    const baseColor = COLOR_BASE.clone();
    const handle = {
      group,
      mesh,
      halo,
      meshMat,
      haloMat,
      baseColor,
      scale: n.scale,
      cats: n.cats,
      catCounts: n.catCounts,
    };
    visuals.current.set(n.id, handle);

    // Initialize base color according to current store state, so newly mounted
    // visuals immediately reflect any active filter.
    const active = useGraphStore.getState().activeCategories;
    applyBaseColor(handle, n, active, active.size > 0);

    return group;
  };

  const setHovered = useGraphStore((s) => s.setHoveredNode);
  const setSelected = useGraphStore((s) => s.setSelectedNode);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <ForceGraph3D
        ref={fgRef as never}
        graphData={data}
        nodeRelSize={1}
        nodeThreeObject={buildNodeObject}
        nodeThreeObjectExtend={false}
        linkOpacity={0}
        linkWidth={0}
        linkVisibility={false}
        enableNodeDrag={false}
        cooldownTicks={0}
        warmupTicks={0}
        d3AlphaDecay={1}
        d3VelocityDecay={1}
        backgroundColor="#050a15"
        showNavInfo={false}
        controlType="orbit"
        rendererConfig={{ antialias: true, powerPreference: "high-performance" }}
        showPointerCursor={false}
        onNodeHover={(node) => {
          const id = (node as FGNode | null)?.id ?? null;
          if (useGraphStore.getState().hoveredNode !== id) setHovered(id);
          document.body.style.cursor = id ? "pointer" : "";
        }}
        onNodeClick={(node) => {
          const id = (node as FGNode).id;
          const current = useGraphStore.getState().selectedNode;
          setSelected(current === id ? null : id);
        }}
        onBackgroundClick={() => setSelected(null)}
      />
    </div>
  );
}

// Pick the active category this node has the most edges of. Returns null if
// the node has no edges in any active category.
function dominantActiveCategory(
  catCounts: Map<Category, number>,
  active: Set<Category>,
): Category | null {
  let best: Category | null = null;
  let bestN = 0;
  for (const c of active) {
    const n = catCounts.get(c) ?? 0;
    if (n > bestN) {
      bestN = n;
      best = c;
    }
  }
  return best;
}

function applyBaseColor(
  v: {
    baseColor: THREE.Color;
    halo: THREE.Mesh;
    haloMat: THREE.MeshBasicMaterial;
    scale: number;
  },
  node: FGNode,
  active: Set<Category>,
  hasFilter: boolean,
) {
  if (!hasFilter) {
    v.baseColor.copy(COLOR_BASE);
    v.halo.scale.setScalar(v.scale * 3.8);
    v.haloMat.opacity = 0.18;
    return;
  }
  const cat = dominantActiveCategory(node.catCounts, active);
  if (cat) {
    v.baseColor.set(CATEGORY_COLOR[cat] ?? "#d4af37");
    v.halo.scale.setScalar(v.scale * 4.2);
    v.haloMat.opacity = 0.22;
  } else {
    v.baseColor.copy(COLOR_ISOLATE);
    v.halo.scale.setScalar(v.scale * 2.4);
    v.haloMat.opacity = 0.06;
  }
}

// ─── Sea (dust + far halo) ──────────────────────────────────────────────────

function buildSea() {
  const group = new THREE.Group();

  // Far halo — backside-rendered gradient sphere.
  const haloGeom = new THREE.SphereGeometry(1, 32, 32);
  const haloMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      uColorA: { value: new THREE.Color("#091a3a") },
      uColorB: { value: new THREE.Color("#02060e") },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec3 vPos;
      void main() {
        float t = clamp((vPos.y + 1.0) * 0.5, 0.0, 1.0);
        vec3 c = mix(uColorB, uColorA, smoothstep(0.0, 1.0, t));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const halo = new THREE.Mesh(haloGeom, haloMat);
  halo.scale.setScalar(120);

  // Gold dust particles.
  const count = 1600;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 38 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const dustGeom = new THREE.BufferGeometry();
  dustGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dustMat = new THREE.PointsMaterial({
    size: 0.45,
    sizeAttenuation: true,
    map: makeDustSprite(),
    alphaTest: 0.001,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: new THREE.Color("#d4af37"),
    opacity: 0.55,
  });
  const dust = new THREE.Points(dustGeom, dustMat);

  group.add(halo, dust);

  halo.raycast = () => {};
  dust.raycast = () => {};

  return {
    group,
    tick(dt: number) {
      dust.rotation.y += dt * 0.012;
      dust.rotation.x += dt * 0.004;
      halo.rotation.z += dt * 0.02;
    },
    dispose() {
      haloGeom.dispose();
      haloMat.dispose();
      dustGeom.dispose();
      dustMat.dispose();
    },
  };
}

let cachedSprite: THREE.CanvasTexture | null = null;
function makeDustSprite(): THREE.CanvasTexture {
  if (cachedSprite) return cachedSprite;
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,235,170,1)");
  grad.addColorStop(0.35, "rgba(212,175,55,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  cachedSprite = new THREE.CanvasTexture(c);
  return cachedSprite;
}

let cachedHaloSprite: THREE.CanvasTexture | null = null;
function makeHaloSprite(): THREE.CanvasTexture {
  if (cachedHaloSprite) return cachedHaloSprite;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  cachedHaloSprite = new THREE.CanvasTexture(c);
  return cachedHaloSprite;
}

// ─── Cluster halos (soft glow sprite at each cluster centroid) ──────────────

type HaloHandle = {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  /** Current position; lerped toward target. */
  cx: number;
  cy: number;
  cz: number;
  /** Target position from the latest layout. */
  tx: number;
  ty: number;
  tz: number;
  /** Current and target visual scale. */
  cs: number;
  ts: number;
  /** Current and target opacity. */
  co: number;
  to: number;
  /** True once at least one frame has been rendered. */
  seeded: boolean;
};

function buildClusterHalos() {
  const group = new THREE.Group();
  const handles = new Map<string, HaloHandle>();
  const tex = makeHaloSprite();

  return {
    group,
    setClusters(clusters: Cluster[]) {
      const seen = new Set<string>();
      for (const c of clusters) {
        if (c.size < 3) continue;
        seen.add(c.id);
        const scale = Math.min(c.radius * 5.5 + 4, 60);
        const opacity = Math.min(0.08 + Math.log2(c.size + 1) * 0.025, 0.22);
        const existing = handles.get(c.id);
        if (existing) {
          existing.tx = c.position.x;
          existing.ty = c.position.y;
          existing.tz = c.position.z;
          existing.ts = scale;
          existing.to = opacity;
          existing.mat.color.set(c.color);
        } else {
          const mat = new THREE.SpriteMaterial({
            map: tex,
            color: new THREE.Color(c.color),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          });
          const sprite = new THREE.Sprite(mat);
          sprite.position.set(c.position.x, c.position.y, c.position.z);
          sprite.scale.set(1, 1, 1);
          sprite.raycast = () => {};
          group.add(sprite);
          handles.set(c.id, {
            sprite,
            mat,
            cx: c.position.x,
            cy: c.position.y,
            cz: c.position.z,
            tx: c.position.x,
            ty: c.position.y,
            tz: c.position.z,
            cs: 1,
            ts: scale,
            co: 0,
            to: opacity,
            seeded: false,
          });
        }
      }
      // Fade out clusters that are no longer present.
      for (const [id, h] of handles) {
        if (!seen.has(id)) h.to = 0;
      }
    },
    tick(dt: number) {
      const alpha = Math.min(dt * 3, 1);
      const toRemove: string[] = [];
      for (const [id, h] of handles) {
        h.cx += (h.tx - h.cx) * alpha;
        h.cy += (h.ty - h.cy) * alpha;
        h.cz += (h.tz - h.cz) * alpha;
        h.cs += (h.ts - h.cs) * alpha;
        h.co += (h.to - h.co) * alpha;
        h.sprite.position.set(h.cx, h.cy, h.cz);
        h.sprite.scale.set(h.cs, h.cs, 1);
        h.mat.opacity = h.co;
        h.seeded = true;
        if (h.to === 0 && h.co < 0.005) {
          group.remove(h.sprite);
          h.mat.dispose();
          toRemove.push(id);
        }
      }
      for (const id of toRemove) handles.delete(id);
    },
    dispose() {
      for (const h of handles.values()) {
        group.remove(h.sprite);
        h.mat.dispose();
      }
      handles.clear();
    },
  };
}

// ─── Edges (curved bezier threads, additive blend, lens-aware) ──────────────

const SEGMENTS = 6;
const VERTS_PER_EDGE = SEGMENTS * 2;

function buildEdges(graph: GraphData) {
  const group = new THREE.Group();
  const edgeCount = graph.edges.length;
  const floatsPerEdge = VERTS_PER_EDGE * 3;

  const positions = new Float32Array(edgeCount * floatsPerEdge);
  const colorsArr = new Float32Array(edgeCount * floatsPerEdge);
  const originalColors = new Float32Array(edgeCount * floatsPerEdge);
  const cats: Category[] = new Array(edgeCount);

  // Seed with per-edge color (uses category palette + weight-based brightness).
  const tmpCol = new THREE.Color();
  graph.edges.forEach((edge, ei) => {
    tmpCol.set(CATEGORY_COLOR[edge.pc] ?? "#d4af37");
    tmpCol.lerp(new THREE.Color("#f5d97a"), Math.min(edge.w / 6, 0.5) * 0.4);
    const base = ei * floatsPerEdge;
    for (let i = 0; i < VERTS_PER_EDGE; i++) {
      colorsArr[base + i * 3 + 0] = tmpCol.r;
      colorsArr[base + i * 3 + 1] = tmpCol.g;
      colorsArr[base + i * 3 + 2] = tmpCol.b;
      originalColors[base + i * 3 + 0] = tmpCol.r;
      originalColors[base + i * 3 + 1] = tmpCol.g;
      originalColors[base + i * 3 + 2] = tmpCol.b;
    }
    cats[ei] = edge.pc;
  });

  const baseGeom = new THREE.BufferGeometry();
  baseGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  baseGeom.setAttribute("color", new THREE.BufferAttribute(colorsArr, 3));

  const baseMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const baseLines = new THREE.LineSegments(baseGeom, baseMat);
  baseLines.renderOrder = -1;
  baseLines.raycast = () => {};

  const hiGeom = new THREE.BufferGeometry();
  const hiMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const hiLines = new THREE.LineSegments(hiGeom, hiMat);
  hiLines.raycast = () => {};

  group.add(baseLines, hiLines);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();

  return {
    group,
    baseMat,
    updatePositions(getPos: (id: string) => { x: number; y: number; z: number }) {
      const attr = baseGeom.getAttribute("position") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      graph.edges.forEach((edge, ei) => {
        const pa = getPos(edge.a);
        const pb = getPos(edge.b);
        a.set(pa.x, pa.y, pa.z);
        b.set(pb.x, pb.y, pb.z);
        mid.copy(a).add(b).multiplyScalar(0.5).multiplyScalar(0.78);
        const base = ei * floatsPerEdge;
        for (let s = 0; s < SEGMENTS; s++) {
          quadBezierInto(p0, a, mid, b, s / SEGMENTS);
          quadBezierInto(p1, a, mid, b, (s + 1) / SEGMENTS);
          const off = base + s * 6;
          arr[off + 0] = p0.x;
          arr[off + 1] = p0.y;
          arr[off + 2] = p0.z;
          arr[off + 3] = p1.x;
          arr[off + 4] = p1.y;
          arr[off + 5] = p1.z;
        }
      });
      attr.needsUpdate = true;
    },
    applyLens(active: Set<Category>) {
      const attr = baseGeom.getAttribute("color") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let ei = 0; ei < edgeCount; ei++) {
        const offset = ei * floatsPerEdge;
        const visible = active.size === 0 || active.has(cats[ei]);
        if (visible) {
          for (let k = 0; k < floatsPerEdge; k++) arr[offset + k] = originalColors[offset + k];
        } else {
          for (let k = 0; k < floatsPerEdge; k++) arr[offset + k] = 0;
        }
      }
      attr.needsUpdate = true;
    },
    rebuildHighlight(
      focusId: string | null,
      active: Set<Category>,
      getPos: (id: string) => { x: number; y: number; z: number },
    ) {
      if (!focusId || !graph.nodes[focusId]) {
        hiGeom.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
        hiGeom.setAttribute("color", new THREE.Float32BufferAttribute([], 3));
        return;
      }
      const pos: number[] = [];
      const col: number[] = [];
      const va = new THREE.Vector3();
      const vb = new THREE.Vector3();
      const vm = new THREE.Vector3();
      const hp0 = new THREE.Vector3();
      const hp1 = new THREE.Vector3();
      const hasFilter = active.size > 0;

      for (const ei of graph.nodes[focusId].e) {
        const edge = graph.edges[ei];
        if (hasFilter && !active.has(edge.pc)) continue;
        const pa = getPos(edge.a);
        const pb = getPos(edge.b);
        va.set(pa.x, pa.y, pa.z);
        vb.set(pb.x, pb.y, pb.z);
        vm.copy(va).add(vb).multiplyScalar(0.5).multiplyScalar(0.78);

        const base = new THREE.Color(CATEGORY_COLOR[edge.pc] ?? "#d4af37");
        base.lerp(new THREE.Color("#fff1b8"), 0.45);

        for (let s = 0; s < SEGMENTS; s++) {
          quadBezierInto(hp0, va, vm, vb, s / SEGMENTS);
          quadBezierInto(hp1, va, vm, vb, (s + 1) / SEGMENTS);
          pos.push(hp0.x, hp0.y, hp0.z, hp1.x, hp1.y, hp1.z);
          col.push(base.r, base.g, base.b, base.r, base.g, base.b);
        }
      }
      hiGeom.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      hiGeom.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    },
    dispose() {
      baseGeom.dispose();
      baseMat.dispose();
      hiGeom.dispose();
      hiMat.dispose();
    },
  };
}

function quadBezierInto(
  out: THREE.Vector3,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  t: number,
) {
  const u = 1 - t;
  out.x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x;
  out.y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
  out.z = u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z;
  return out;
}
