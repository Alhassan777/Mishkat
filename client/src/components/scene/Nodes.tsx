"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Category, GraphData } from "@/types/graph";
import type { Layout } from "@/lib/layout";
import { useGraphStore } from "@/lib/store";

type Props = {
  graph: GraphData;
  layout: Layout;
  ids: string[];
};

function hasAny<T>(a: Set<T>, b: Set<T>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

const COLOR_DIM = new THREE.Color("#3a2c0e");
const COLOR_BASE = new THREE.Color("#b8902a");
const COLOR_NEIGHBOR = new THREE.Color("#e8c14a");
const COLOR_FOCUS = new THREE.Color("#fff1b8");

const HIDDEN_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

export function Nodes({ graph, layout, ids }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.InstancedMesh>(null);

  const setHovered = useGraphStore((s) => s.setHoveredNode);
  const setSelected = useGraphStore((s) => s.setSelectedNode);

  // Per-instance base scale (slight emphasis on hub nodes).
  const baseScales = useMemo(() => {
    return ids.map((id) => {
      const deg = graph.nodes[id]?.e.length ?? 0;
      // 0.16 .. 0.42, gentle log curve so hubs read but don't dominate.
      return 0.16 + Math.min(Math.log2(deg + 1) * 0.05, 0.26);
    });
  }, [ids, graph]);

  // For each node, the set of categories present on its edges. Used by the
  // lens: a node "passes" if it carries any thread in the active set.
  const nodeCategories = useMemo<Set<Category>[]>(() => {
    return ids.map((id) => {
      const set = new Set<Category>();
      for (const ei of graph.nodes[id]?.e ?? []) {
        set.add(graph.edges[ei].pc);
      }
      return set;
    });
  }, [ids, graph]);

  // Rewrite per-instance matrices based on the current lens + selection.
  // Hidden = scale 0, which both removes the visual and disables picking.
  // The focused node is always kept visible, even if the lens would hide it.
  useEffect(() => {
    const apply = () => {
      const mesh = meshRef.current;
      const halo = haloRef.current;
      if (!mesh || !halo) return;
      const { activeCategories, selectedNode } = useGraphStore.getState();
      const hasFilter = activeCategories.size > 0;
      const dummy = new THREE.Object3D();

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const passesLens = !hasFilter || hasAny(nodeCategories[i], activeCategories);
        const visible = passesLens || id === selectedNode;

        if (!visible) {
          mesh.setMatrixAt(i, HIDDEN_MATRIX);
          halo.setMatrixAt(i, HIDDEN_MATRIX);
          continue;
        }

        const p = layout.positions[id];
        dummy.position.set(p.x, p.y, p.z);
        const s = baseScales[i];
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        dummy.scale.setScalar(s * 3.8);
        dummy.updateMatrix();
        halo.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      halo.instanceMatrix.needsUpdate = true;
    };

    // Initial paint — also seed colors so meshStandardMaterial has instanceColor.
    apply();
    const mesh = meshRef.current;
    const halo = haloRef.current;
    if (mesh && halo) {
      for (let i = 0; i < ids.length; i++) {
        mesh.setColorAt(i, COLOR_BASE);
        halo.setColorAt(i, COLOR_BASE);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
    }

    return useGraphStore.subscribe((state, prev) => {
      if (
        state.activeCategories !== prev.activeCategories ||
        state.selectedNode !== prev.selectedNode
      ) {
        apply();
      }
    });
  }, [ids, layout, baseScales, nodeCategories]);

  // Color updates driven by hover / selection — done outside React render.
  // Hidden instances still get color writes (cheap) but are invisible anyway.
  useFrame(() => {
    const mesh = meshRef.current;
    const halo = haloRef.current;
    if (!mesh || !halo) return;
    const { hoveredNode, selectedNode, graph: g } = useGraphStore.getState();
    if (!g) return;

    const focus = selectedNode ?? hoveredNode;
    const neighbors = new Set<string>();
    if (focus && g.nodes[focus]) {
      for (const ei of g.nodes[focus].e) {
        const edge = g.edges[ei];
        neighbors.add(edge.a === focus ? edge.b : edge.a);
      }
    }

    const tmp = new THREE.Color();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      let target: THREE.Color;
      if (id === focus) target = COLOR_FOCUS;
      else if (!focus) target = COLOR_BASE;
      else if (neighbors.has(id)) target = COLOR_NEIGHBOR;
      else target = COLOR_DIM;

      mesh.getColorAt(i, tmp);
      tmp.lerp(target, 0.18);
      mesh.setColorAt(i, tmp);

      halo.getColorAt(i, tmp);
      tmp.lerp(target, 0.18);
      halo.setColorAt(i, tmp);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
  });

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const i = e.instanceId;
    if (typeof i !== "number") return;
    const id = ids[i];
    if (useGraphStore.getState().hoveredNode !== id) setHovered(id);
    document.body.style.cursor = "pointer";
  };
  const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(null);
    document.body.style.cursor = "";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const i = e.instanceId;
    if (typeof i !== "number") return;
    const id = ids[i];
    const current = useGraphStore.getState().selectedNode;
    setSelected(current === id ? null : id);
  };

  return (
    <group>
      {/* Halo sphere — additive blending behind each ink-drop. */}
      <instancedMesh
        ref={haloRef}
        args={[undefined, undefined, ids.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>

      {/* The ink drops themselves — small refractive-feeling spheres. */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, ids.length]}
        frustumCulled={false}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
        onClick={onClick}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          metalness={0.6}
          roughness={0.25}
          emissive={new THREE.Color("#d4af37")}
          emissiveIntensity={0.45}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
