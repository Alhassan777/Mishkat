"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { GraphData } from "@/types/graph";
import { buildLayout } from "@/lib/layout";
import { Sea } from "./Sea";
import { Nodes } from "./Nodes";
import { Edges } from "./Edges";
import { useGraphStore } from "@/lib/store";

export function Scene({ graph }: { graph: GraphData }) {
  const layout = useMemo(() => buildLayout(graph), [graph]);
  const ids = useMemo(() => Object.keys(graph.nodes), [graph]);

  const clearSelectionIfBackground = (e: React.PointerEvent) => {
    // Three's onPointerMissed equivalent — clicked the canvas, not a mesh.
    const target = e.target as HTMLElement;
    if (target.tagName === "CANVAS") {
      useGraphStore.getState().setSelectedNode(null);
    }
  };

  return (
    <div className="absolute inset-0" onPointerDown={clearSelectionIfBackground}>
      <Canvas
        camera={{ position: [0, 6, 70], fov: 42, near: 0.1, far: 400 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          scene.background = new THREE.Color("#050a15");
          scene.fog = new THREE.FogExp2("#050a15", 0.008);
        }}
      >
        <ambientLight intensity={0.32} color="#a8c0ff" />
        <pointLight position={[40, 30, 40]} intensity={1.4} color="#f5d97a" />
        <pointLight position={[-30, -20, 20]} intensity={0.6} color="#3a6fc4" />

        <Sea />
        <Edges graph={graph} layout={layout} />
        <Nodes graph={graph} layout={layout} ids={ids} />

        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.55}
          zoomSpeed={0.7}
          minDistance={26}
          maxDistance={130}
          makeDefault
        />
      </Canvas>
    </div>
  );
}
