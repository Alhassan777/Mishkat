import type { VerseNode } from '../../data/types'

export const POSITIONS_STORAGE_KEY = 'ayat-graph-positions-v2'

export type NodePosition = { x: number; y: number }
export type NodePositionMap = Record<string, NodePosition>
export type SurahCircle = { surah: number; cx: number; cy: number; radius: number }

const SURAH_GAP = 60
const RING_GAP = 12
const BASE_NODE_PADDING = 10

function groupBySurah(nodes: VerseNode[]) {
  const bySurah = new Map<number, VerseNode[]>()
  for (const node of nodes) {
    const bucket = bySurah.get(node.surah) ?? []
    bucket.push(node)
    bySurah.set(node.surah, bucket)
  }
  return Array.from(bySurah.entries()).sort((a, b) => a[0] - b[0])
}

function surahCircleRadius(ayahCount: number) {
  return Math.max(20, 6 * Math.sqrt(ayahCount) + BASE_NODE_PADDING)
}

export function computeSurahCircles(nodes: VerseNode[]): SurahCircle[] {
  const surahEntries = groupBySurah(nodes)
  if (surahEntries.length === 0) return []

  const maxCircleRadius = surahEntries.reduce(
    (maxRadius, [, surahNodes]) => Math.max(maxRadius, surahCircleRadius(surahNodes.length)),
    20
  )
  const cellSize = 2 * maxCircleRadius + SURAH_GAP
  const columns = Math.max(1, Math.ceil(Math.sqrt(surahEntries.length)))
  const rows = Math.ceil(surahEntries.length / columns)
  const xOrigin = -((columns - 1) * cellSize) / 2
  const yOrigin = -((rows - 1) * cellSize) / 2

  return surahEntries.map(([surah, surahNodes], index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    return {
      surah,
      cx: xOrigin + col * cellSize,
      cy: yOrigin + row * cellSize,
      radius: surahCircleRadius(surahNodes.length),
    }
  })
}

export function computeInitialLayout(nodes: VerseNode[]): NodePositionMap {
  const surahEntries = groupBySurah(nodes)
  const circlesBySurah = new Map(
    computeSurahCircles(nodes).map((circle) => [circle.surah, circle])
  )
  const positions: NodePositionMap = {}

  surahEntries.forEach(([surah, surahNodes]) => {
    const circle = circlesBySurah.get(surah)
    if (!circle) return
    const orderedNodes = [...surahNodes].sort((a, b) => a.ayah - b.ayah)
    const maxRingRadius = Math.max(0, circle.radius - BASE_NODE_PADDING)
    const ringCounts: number[] = []
    let placed = 0
    let ringIdx = 0
    while (placed < orderedNodes.length) {
      const ringRadius = ringIdx * RING_GAP
      if (ringRadius > maxRingRadius) break
      if (ringIdx === 0) {
        ringCounts.push(1)
        placed += 1
      } else {
        const circumference = 2 * Math.PI * ringRadius
        const capacity = Math.max(6, Math.floor(circumference / 8))
        const count = Math.min(capacity, orderedNodes.length - placed)
        ringCounts.push(count)
        placed += count
      }
      ringIdx += 1
    }

    let cursor = 0
    ringCounts.forEach((count, idx) => {
      const ringRadius = idx * RING_GAP
      for (let i = 0; i < count; i += 1) {
        const node = orderedNodes[cursor]
        if (!node) break
        if (idx === 0) {
          positions[node.id] = { x: circle.cx, y: circle.cy }
          cursor += 1
          continue
        }
        const theta = (i / count) * Math.PI * 2
        positions[node.id] = {
          x: circle.cx + Math.cos(theta) * ringRadius,
          y: circle.cy + Math.sin(theta) * ringRadius,
        }
        cursor += 1
      }
    })

    if (cursor < orderedNodes.length) {
      // Fallback for overflow: place remaining ayat near the perimeter.
      const remaining = orderedNodes.length - cursor
      for (let i = 0; i < remaining; i += 1) {
        const node = orderedNodes[cursor + i]
        const theta = (i / Math.max(1, remaining)) * Math.PI * 2
        positions[node.id] = {
          x: circle.cx + Math.cos(theta) * maxRingRadius,
          y: circle.cy + Math.sin(theta) * maxRingRadius,
        }
      }
    }

    if (orderedNodes.length === 1) {
      const only = orderedNodes[0]
      if (only) {
        positions[only.id] = { x: circle.cx, y: circle.cy }
        return
      }
    }
  })

  return positions
}

export function loadSavedPositions(): NodePositionMap | null {
  try {
    const raw = localStorage.getItem(POSITIONS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as NodePositionMap
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function savePositions(nodes: VerseNode[]) {
  const payload: NodePositionMap = {}
  for (const node of nodes) {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') continue
    payload[node.id] = { x: node.x, y: node.y }
  }
  localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(payload))
}

export function clearSavedPositions() {
  localStorage.removeItem(POSITIONS_STORAGE_KEY)
}
