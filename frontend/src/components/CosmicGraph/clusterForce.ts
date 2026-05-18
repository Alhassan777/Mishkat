type ForceNode = {
  id: string
  surah: number
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

type ClusterCenter = { x: number; y: number; count: number }

export type ClusterForce = {
  (alpha: number): void
  initialize: (nodes: ForceNode[]) => void
}

export function createSurahClusterForce(strength = 0.3): ClusterForce {
  let nodes: ForceNode[] = []

  const force = ((alpha: number) => {
    if (nodes.length === 0) return

    const centers = new Map<number, ClusterCenter>()
    for (const node of nodes) {
      const x = node.fx ?? node.x
      const y = node.fy ?? node.y
      if (x == null || y == null) continue

      const center = centers.get(node.surah) ?? { x: 0, y: 0, count: 0 }
      center.x += x
      center.y += y
      center.count += 1
      centers.set(node.surah, center)
    }

    centers.forEach(center => {
      if (center.count === 0) return
      center.x /= center.count
      center.y /= center.count
    })

    for (const node of nodes) {
      if (node.fx != null || node.fy != null) continue
      const center = centers.get(node.surah)
      if (!center) continue
      const x = node.x ?? center.x
      const y = node.y ?? center.y
      node.vx = (node.vx ?? 0) + (center.x - x) * strength * alpha
      node.vy = (node.vy ?? 0) + (center.y - y) * strength * alpha
    }
  }) as ClusterForce

  force.initialize = (newNodes: ForceNode[]) => {
    nodes = newNodes
  }

  return force
}
