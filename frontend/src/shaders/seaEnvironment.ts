import * as THREE from 'three'

export interface SeaEnvironment {
  update: (timeSeconds: number) => void
  dispose: () => void
}

export function createSeaEnvironment(scene: THREE.Scene): SeaEnvironment {
  scene.fog = new THREE.FogExp2(0x050a15, 0.0015)

  const count = 900
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    positions[i3] = (Math.random() - 0.5) * 1600
    positions[i3 + 1] = (Math.random() - 0.5) * 900
    positions[i3 + 2] = (Math.random() - 0.5) * 1500
    seeds[i] = Math.random() * Math.PI * 2
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float aSeed;
      uniform float uTime;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.25 + aSeed) * 6.0;
        p.x += cos(uTime * 0.2 + aSeed * 1.5) * 3.0;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 2.2 * (220.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        float alpha = smoothstep(0.5, 0.0, d) * 0.42;
        gl_FragColor = vec4(0.9, 0.78, 0.42, alpha);
      }
    `,
  })

  const points = new THREE.Points(geometry, material)
  points.renderOrder = 0
  scene.add(points)

  return {
    update: (timeSeconds: number) => {
      material.uniforms.uTime.value = timeSeconds
    },
    dispose: () => {
      scene.remove(points)
      geometry.dispose()
      material.dispose()
      scene.fog = null
    },
  }
}
