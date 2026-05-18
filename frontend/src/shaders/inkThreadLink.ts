import * as THREE from 'three'

interface LinkState {
  material: THREE.ShaderMaterial
  radius: number
  tubularSegments: number
  prev: {
    sx: number
    sy: number
    sz: number
    tx: number
    ty: number
    tz: number
  }
}

function createCurve(
  source: THREE.Vector3,
  target: THREE.Vector3,
): THREE.CatmullRomCurve3 {
  const mid = source.clone().add(target).multiplyScalar(0.5)
  const dir = target.clone().sub(source)
  const lift = new THREE.Vector3(0, Math.max(6, dir.length() * 0.15), 0)
  return new THREE.CatmullRomCurve3([source, mid.add(lift), target])
}

function createMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float flow = fract(vUv.x * 2.5 - uTime * 0.55);
        float head = smoothstep(0.0, 0.06, flow) * (1.0 - smoothstep(0.2, 0.35, flow));
        float body = 1.0 - smoothstep(0.0, 0.08, vUv.x) - smoothstep(1.0, 0.92, vUv.x);
        body = clamp(body, 0.0, 1.0);
        float edgeFade = smoothstep(0.02, 0.18, vUv.y) * (1.0 - smoothstep(0.82, 0.98, vUv.y));
        float alpha = (0.15 + head * 0.45 + body * 0.35) * edgeFade;
        vec3 color = mix(uColor, vec3(1.0, 0.93, 0.7), head * 0.8 + body * 0.25);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  })
}

function buildGeometry(
  source: THREE.Vector3,
  target: THREE.Vector3,
  radius: number,
  tubularSegments: number,
): THREE.TubeGeometry {
  const curve = createCurve(source, target)
  return new THREE.TubeGeometry(curve, tubularSegments, radius, 10, false)
}

export function createInkThread(
  source: THREE.Vector3,
  target: THREE.Vector3,
  colorHex: string,
): THREE.Mesh {
  const radius = 0.55
  const tubularSegments = 20
  const material = createMaterial(new THREE.Color(colorHex))
  const geometry = buildGeometry(source, target, radius, tubularSegments)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.renderOrder = 2
  mesh.userData.inkThread = {
    material,
    radius,
    tubularSegments,
    prev: {
      sx: source.x, sy: source.y, sz: source.z,
      tx: target.x, ty: target.y, tz: target.z,
    },
  } satisfies LinkState
  return mesh
}

export function updateInkThread(
  mesh: THREE.Mesh,
  source: THREE.Vector3,
  target: THREE.Vector3,
): void {
  const state = mesh.userData.inkThread as LinkState | undefined
  if (!state) return
  const p = state.prev
  const changed = Math.abs(p.sx - source.x) > 0.5
    || Math.abs(p.sy - source.y) > 0.5
    || Math.abs(p.sz - source.z) > 0.5
    || Math.abs(p.tx - target.x) > 0.5
    || Math.abs(p.ty - target.y) > 0.5
    || Math.abs(p.tz - target.z) > 0.5
  if (!changed) return
  mesh.geometry.dispose()
  mesh.geometry = buildGeometry(source, target, state.radius, state.tubularSegments)
  state.prev = {
    sx: source.x, sy: source.y, sz: source.z,
    tx: target.x, ty: target.y, tz: target.z,
  }
}

export function updateInkThreadTime(mesh: THREE.Mesh, timeSeconds: number): void {
  const state = mesh.userData.inkThread as LinkState | undefined
  if (!state) return
  state.material.uniforms.uTime.value = timeSeconds
}
