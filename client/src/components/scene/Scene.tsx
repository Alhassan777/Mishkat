"use client";

import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import type { ForceGraphMethods } from "react-force-graph-3d";
import type { Category, GraphData } from "@/types/graph";
import { CATEGORY_COLOR } from "@/types/graph";
import { buildLayout, type Layout } from "@/lib/layout";
import { useGraphStore } from "@/lib/store";

// react-force-graph-3d touches `window` at import time → must be client-only.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

type FGNode = {
  id: string;
  fx: number;
  fy: number;
  fz: number;
  scale: number;
  cats: Set<Category>;
};

type FGLink = {
  source: string;
  target: string;
};

const COLOR_DIM = new THREE.Color("#3a2c0e");
const COLOR_BASE = new THREE.Color("#b8902a");
const COLOR_NEIGHBOR = new THREE.Color("#e8c14a");
const COLOR_FOCUS = new THREE.Color("#fff1b8");

const SHARED_SPHERE = new THREE.SphereGeometry(1, 16, 16);
const SHARED_HALO = new THREE.SphereGeometry(1, 12, 12);

export function Scene({ graph }: { graph: GraphData }) {
  const layout = useMemo(() => buildLayout(graph), [graph]);
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
        cats: Set<Category>;
        scale: number;
      }
    >
  >(new Map());

  // --- Build node/link data (positions are fixed → simulation is a no-op). ---
  const data = useMemo(() => {
    const ids = Object.keys(graph.nodes);

    const nodeCategories = (id: string): Set<Category> => {
      const set = new Set<Category>();
      for (const ei of graph.nodes[id]?.e ?? []) set.add(graph.edges[ei].pc);
      return set;
    };

    const nodes: FGNode[] = ids.map((id) => {
      const p = layout.positions[id];
      const deg = graph.nodes[id]?.e.length ?? 0;
      const scale = 0.16 + Math.min(Math.log2(deg + 1) * 0.05, 0.26);
      return { id, fx: p.x, fy: p.y, fz: p.z, scale, cats: nodeCategories(id) };
    });

    // Links are purely structural — drawn separately as LineSegments. We still
    // hand them to ForceGraph3D so its hover/select neighbor logic could work,
    // but we render them invisibly via linkOpacity=0 and a custom no-op threeObject.
    const links: FGLink[] = [];

    return { nodes, links };
  }, [graph, layout]);

  // --- Plain three.js side effects: Sea, Edges, lights, fog, color updates. ---
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
    const edges = buildEdges(graph, layout);
    scene.add(edges.group);

    // Camera framing.
    fg.cameraPosition({ x: 0, y: 6, z: 70 });

    // --- Reactive store wiring. ---
    const applyLens = () => {
      const active = useGraphStore.getState().activeCategories;
      const selected = useGraphStore.getState().selectedNode;
      const hasFilter = active.size > 0;
      // Nodes: hide if they carry no active category (focus stays visible).
      for (const [id, v] of visuals.current) {
        const passes = !hasFilter || hasAny(v.cats, active);
        v.group.visible = passes || id === selected;
      }
      // Edges: zero color of filtered-out edges (additive blend → invisible).
      edges.applyLens(active);
    };

    const applyHighlight = () => {
      const { hoveredNode, selectedNode, graph: g } = useGraphStore.getState();
      if (!g) return;
      const focus = selectedNode ?? hoveredNode;
      const neighbors = new Set<string>();
      if (focus && g.nodes[focus]) {
        for (const ei of g.nodes[focus].e) {
          const e = g.edges[ei];
          neighbors.add(e.a === focus ? e.b : e.a);
        }
      }
      // Stash for the RAF lerp (smooth color transitions).
      colorTarget.focus = focus;
      colorTarget.neighbors = neighbors;
      edges.rebuildHighlight(focus, useGraphStore.getState().activeCategories);
    };

    const colorTarget: { focus: string | null; neighbors: Set<string> } = {
      focus: null,
      neighbors: new Set(),
    };

    applyLens();
    applyHighlight();

    const unsub = useGraphStore.subscribe((state, prev) => {
      if (
        state.activeCategories !== prev.activeCategories ||
        state.selectedNode !== prev.selectedNode
      ) {
        applyLens();
      }
      const focus = state.selectedNode ?? state.hoveredNode;
      const prevFocus = prev.selectedNode ?? prev.hoveredNode;
      if (focus !== prevFocus || state.activeCategories !== prev.activeCategories) {
        applyHighlight();
      }
    });

    // --- RAF: color lerp + sea drift + edge opacity easing. ---
    const tmp = new THREE.Color();
    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const dt = clock.getDelta();
      // Sea rotation.
      sea.tick(dt);

      // Edge base opacity easing (mode-aware).
      const { activeCategories, selectedNode, hoveredNode } = useGraphStore.getState();
      const hasFilter = activeCategories.size > 0;
      const hasFocus = !!(selectedNode || hoveredNode);
      const target = hasFilter ? (hasFocus ? 0.55 : 0.7) : hasFocus ? 0.07 : 0.22;
      edges.baseMat.opacity += (target - edges.baseMat.opacity) * Math.min(dt * 4, 1);

      // Node color lerp.
      const focus = colorTarget.focus;
      const neighbors = colorTarget.neighbors;
      for (const [id, v] of visuals.current) {
        let to: THREE.Color;
        if (id === focus) to = COLOR_FOCUS;
        else if (!focus) to = COLOR_BASE;
        else if (neighbors.has(id)) to = COLOR_NEIGHBOR;
        else to = COLOR_DIM;

        tmp.copy(v.meshMat.color).lerp(to, 0.18);
        v.meshMat.color.copy(tmp);
        v.meshMat.emissive.copy(tmp).multiplyScalar(0.6);
        v.haloMat.color.copy(tmp);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      unsub();
      scene.remove(amb, p1, p2, sea.group, edges.group);
      sea.dispose();
      edges.dispose();
    };
  }, [graph, layout]);

  // Click-on-empty-space clears selection.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onBg = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "CANVAS") {
        // ForceGraph3D's own onBackgroundClick fires too; this is a safety net.
      }
    };
    el.addEventListener("pointerdown", onBg);
    return () => el.removeEventListener("pointerdown", onBg);
  }, []);

  // --- nodeThreeObject: build sphere + halo group for each node. ---
  const buildNodeObject = (raw: object) => {
    const n = raw as FGNode;
    const group = new THREE.Group();
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
    // Halo is non-pickable so it never blocks the inner sphere's clicks.
    halo.raycast = () => {};
    group.add(halo, mesh);
    // Tag mesh with node id so onNodeClick → reliable id lookup.
    visuals.current.set(n.id, {
      group,
      mesh,
      halo,
      meshMat,
      haloMat,
      cats: n.cats,
      scale: n.scale,
    });
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

function hasAny<T>(a: Set<T>, b: Set<T>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
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

  // Both halo and dust are decorative — exclude from picking.
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

// ─── Edges (curved bezier threads, additive blend, lens-aware) ──────────────

const SEGMENTS = 6;
const VERTS_PER_EDGE = SEGMENTS * 2;

function buildEdges(graph: GraphData, layout: Layout) {
  const group = new THREE.Group();

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
    mid.copy(a).add(b).multiplyScalar(0.5).multiplyScalar(0.78);

    const col = new THREE.Color(CATEGORY_COLOR[edge.pc] ?? "#d4af37");
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

  const baseGeom = new THREE.BufferGeometry();
  baseGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  baseGeom.setAttribute("color", new THREE.Float32BufferAttribute(colors.slice(), 3));
  const originalColors = new Float32Array(colors);

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

  return {
    group,
    baseMat,
    applyLens(active: Set<Category>) {
      const attr = baseGeom.getAttribute("color") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const stride = VERTS_PER_EDGE * 3;
      for (let ei = 0; ei < cats.length; ei++) {
        const offset = ei * stride;
        const visible = active.size === 0 || active.has(cats[ei]);
        if (visible) {
          for (let k = 0; k < stride; k++) arr[offset + k] = originalColors[offset + k];
        } else {
          for (let k = 0; k < stride; k++) arr[offset + k] = 0;
        }
      }
      attr.needsUpdate = true;
    },
    rebuildHighlight(focusId: string | null, active: Set<Category>) {
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
      const hasFilter = active.size > 0;

      for (const ei of graph.nodes[focusId].e) {
        const edge = graph.edges[ei];
        if (hasFilter && !active.has(edge.pc)) continue;
        const pa = layout.positions[edge.a];
        const pb = layout.positions[edge.b];
        if (!pa || !pb) continue;
        va.set(pa.x, pa.y, pa.z);
        vb.set(pb.x, pb.y, pb.z);
        vm.copy(va).add(vb).multiplyScalar(0.5).multiplyScalar(0.78);

        const base = new THREE.Color(CATEGORY_COLOR[edge.pc] ?? "#d4af37");
        base.lerp(new THREE.Color("#fff1b8"), 0.45);

        for (let s = 0; s < SEGMENTS; s++) {
          const t0 = s / SEGMENTS;
          const t1 = (s + 1) / SEGMENTS;
          const p0 = quadBezier(va, vm, vb, t0);
          const p1 = quadBezier(va, vm, vb, t1);
          pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
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

function quadBezier(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, t: number) {
  const u = 1 - t;
  return new THREE.Vector3(
    u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z,
  );
}
