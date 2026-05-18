import * as THREE from 'three'

export interface InkDropNode {
  group: THREE.Group
  update: (timeSeconds: number, focusLevel: number) => void
}

let glowTexture: THREE.CanvasTexture | null = null

function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create glow texture context')
  const m = size / 2
  const gradient = ctx.createRadialGradient(m, m, 0, m, m, m)
  gradient.addColorStop(0, 'rgba(250, 232, 170, 0.95)')
  gradient.addColorStop(0.3, 'rgba(212, 175, 55, 0.45)')
  gradient.addColorStop(0.65, 'rgba(180, 130, 40, 0.16)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  glowTexture = new THREE.CanvasTexture(canvas)
  return glowTexture
}

function buildShellMaterial(baseColor: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uFocus: { value: 0 },
      uColor: { value: baseColor },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uFocus;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 displaced = position + normal * (sin((position.y + uTime * 1.2) * 7.0) * (0.015 + uFocus * 0.03));
        vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uFocus;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.4);
        float liquid = 0.55 + 0.45 * sin((vWorldPos.y + vWorldPos.x) * 2.8);
        vec3 refracted = mix(uColor * 0.55, vec3(0.95, 0.9, 0.7), fresnel * 0.75);
        vec3 finalColor = mix(refracted, uColor, liquid * 0.22);
        float alpha = 0.18 + fresnel * 0.34 + uFocus * 0.16;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
  })
}

function buildCoreMaterial(baseColor: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uFocus: { value: 0 },
      uColor: { value: baseColor },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFocus;
      uniform vec3 uColor;
      varying vec3 vPos;
      void main() {
        float pulse = 0.65 + 0.35 * sin(uTime * 2.4 + length(vPos) * 9.0);
        float radial = 1.0 - smoothstep(0.0, 1.0, length(vPos));
        vec3 glow = mix(uColor * 0.55, vec3(1.0, 0.95, 0.75), 0.35 + uFocus * 0.3);
        gl_FragColor = vec4(glow * (0.5 + radial * pulse), 0.92);
      }
    `,
  })
}

export function createInkDropNode(degree: number, hexColor: string): InkDropNode {
  const radius = Math.sqrt(Math.max(1, degree)) * 2.5 + 1.5
  const color = new THREE.Color(hexColor)
  const group = new THREE.Group()

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.08, 32, 24),
    buildShellMaterial(color),
  )
  group.add(shell)

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.8, 24, 18),
    buildCoreMaterial(color),
  )
  group.add(core)

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getGlowTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.42,
    }),
  )
  const haloSize = radius * 5.8
  halo.scale.set(haloSize, haloSize, 1)
  group.add(halo)

  const light = new THREE.PointLight(0xd4af37, 0, radius * 14)
  group.add(light)

  const shellMat = shell.material as THREE.ShaderMaterial
  const coreMat = core.material as THREE.ShaderMaterial

  return {
    group,
    update: (timeSeconds: number, focusLevel: number) => {
      shellMat.uniforms.uTime.value = timeSeconds
      shellMat.uniforms.uFocus.value = focusLevel
      coreMat.uniforms.uTime.value = timeSeconds
      coreMat.uniforms.uFocus.value = focusLevel
      ;(halo.material as THREE.SpriteMaterial).opacity = 0.28 + focusLevel * 0.55
      const scale = 1 + focusLevel * 0.35
      halo.scale.set(haloSize * scale, haloSize * scale, 1)
      light.intensity = focusLevel * 0.75
    },
  }
}
