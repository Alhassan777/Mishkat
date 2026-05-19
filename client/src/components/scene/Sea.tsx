"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The "Sea" — atmospheric background: a slowly drifting cloud of fine
 * gold-dust particles, plus a far-away dark halo. No content, just mood.
 */
export function Sea() {
  const ref = useRef<THREE.Points>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  const { geometry, material } = useMemo(() => {
    const count = 1600;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Distribute in a thick spherical shell around the graph.
      const radius = 38 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      sizes[i] = 0.06 + Math.random() * 0.18;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const sprite = makeDustSprite();
    const m = new THREE.PointsMaterial({
      size: 0.45,
      sizeAttenuation: true,
      map: sprite,
      alphaTest: 0.001,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color("#d4af37"),
      opacity: 0.55,
    });
    return { geometry: g, material: m };
  }, []);

  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.012;
      ref.current.rotation.x += dt * 0.004;
    }
    if (haloRef.current) {
      haloRef.current.rotation.z += dt * 0.02;
    }
  });

  return (
    <group>
      {/* Far halo — a faint additive sphere giving the scene volumetric depth. */}
      <mesh ref={haloRef} scale={120}>
        <sphereGeometry args={[1, 32, 32]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          uniforms={{
            uColorA: { value: new THREE.Color("#091a3a") },
            uColorB: { value: new THREE.Color("#02060e") },
          }}
          vertexShader={`
            varying vec3 vPos;
            void main() {
              vPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            varying vec3 vPos;
            void main() {
              float t = clamp((vPos.y + 1.0) * 0.5, 0.0, 1.0);
              vec3 c = mix(uColorB, uColorA, smoothstep(0.0, 1.0, t));
              gl_FragColor = vec4(c, 1.0);
            }
          `}
        />
      </mesh>
      <points ref={ref} geometry={geometry} material={material} />
    </group>
  );
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
