import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import type { DerivedData, VerseNode } from '../../data/types'
import { CATEGORY_COLORS } from '../../data/types'
import { useStore } from '../../store'
import { OnboardingTooltip } from './OnboardingTooltip'
import { useShallow } from 'zustand/shallow'
import { createInkDropNode, type InkDropNode } from '../../shaders/inkDropNode'
import { createInkThread, updateInkThread, updateInkThreadTime } from '../../shaders/inkThreadLink'
import { createSeaEnvironment, type SeaEnvironment } from '../../shaders/seaEnvironment'
import {
  clearSavedPositions,
  computeInitialLayout,
  computeSurahCircles,
  loadSavedPositions,
  savePositions,
} from './layoutPositions'

interface Props { data: DerivedData }

type GraphModule = { default: React.ComponentType<Record<string, unknown>> }
type SurahCircleMeta = { cx: number; cy: number; radius: number }

const PULSE_WINDOW_MS = 2600
const STAGGER_MS = 120
const MAX_3D_NODES = 550
const MAX_3D_EDGES = 1100

const edgeKey = (a: string, b: string) => `${a}::${b}`

function getNodeColor(_node: VerseNode): string {
  return '#D4AF37'
}

/*
  Gem-in-golden-setting rendering:
  1. Warm gold outer halo  — references Islamic lamp light / gilded manuscript
  2. Solid category-color fill — the gemstone itself (carnelian, lapis, emerald…)
  3. Gold ring stroke  — the metal bezel / ذهب
  4. Inner highlight  — gives the stone depth and catches light
*/
function drawGlowNode(
  node: VerseNode,
  ctx: CanvasRenderingContext2D,
  _globalScale: number,
  focused: boolean,
  hovered: boolean,
  nowMs: number,
) {
  const color = getNodeColor(node)
  const degree = Math.max(1, node.degree)
  const breath = 0.88 + Math.sin(nowMs * 0.002 + degree * 0.8) * 0.12
  const ignite = focused ? 1 : hovered ? 0.7 : 0.35
  const r = (Math.sqrt(degree) * 3 + 2.5) * (0.92 + breath * 0.11)
  const x = node.x ?? 0
  const y = node.y ?? 0

  // 1) Outer nur halo that "breathes"
  const haloR = r * (2.8 + ignite * 2.4)
  const halo = ctx.createRadialGradient(x, y, r * 0.7, x, y, haloR)
  halo.addColorStop(0, `rgba(242,220,162,${0.2 + ignite * 0.45})`)
  halo.addColorStop(0.4, `rgba(201,168,76,${0.06 + ignite * 0.12})`)
  halo.addColorStop(1, 'rgba(201,168,76,0.00)')
  ctx.beginPath()
  ctx.arc(x, y, haloR, 0, 2 * Math.PI)
  ctx.fillStyle = halo
  ctx.fill()

  // 2) Glass shell
  ctx.beginPath()
  ctx.arc(x, y, r * 1.08, 0, 2 * Math.PI)
  ctx.fillStyle = `rgba(220,245,255,${0.08 + ignite * 0.12})`
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y, r * 1.08, 0, 2 * Math.PI)
  ctx.strokeStyle = `rgba(230,250,255,${0.2 + ignite * 0.35})`
  ctx.lineWidth = focused ? 1.8 : 1.1
  ctx.stroke()

  // 3) Inner lamp core
  ctx.beginPath()
  ctx.arc(x, y, r * 0.76, 0, 2 * Math.PI)
  ctx.fillStyle = focused ? '#fffdf0' : color
  ctx.fill()

  // 4) Golden rim
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 2 * Math.PI)
  ctx.strokeStyle = focused ? 'rgba(246,224,148,1)' : hovered ? 'rgba(236,213,140,0.85)' : 'rgba(201,168,76,0.52)'
  ctx.lineWidth = focused ? 2 : 1.2
  ctx.stroke()

  // 5) Lamp highlight
  if (degree >= 2 || focused) {
    ctx.beginPath()
    ctx.arc(x - r * 0.22, y - r * 0.28, r * 0.28, 0, 2 * Math.PI)
    ctx.fillStyle = focused ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'
    ctx.fill()
  }
}

export function CosmicGraph({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Record<string, unknown> | null>(null)
  const hoveredRef = useRef<string | null>(null)
  const focusedNodeIdRef = useRef<string | null>(null)
  const pulseScheduleRef = useRef<Map<string, number>>(new Map())
  const nodeObjectCache = useRef<Map<string, InkDropNode>>(new Map())
  const linkObjectCache = useRef<Map<string, THREE.Mesh>>(new Map())
  const seaEnvironmentRef = useRef<SeaEnvironment | null>(null)
  const surahArtifactRef = useRef<Map<number, THREE.Mesh>>(new Map())

  const [graphMod, setGraphMod] = useState<GraphModule | null>(null)
  const [is3D, setIs3D] = useState(false)
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })
  const isShiftPressedRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const surahCirclesRef = useRef<Map<number, SurahCircleMeta>>(new Map())
  const pendingHealSaveRef = useRef<VerseNode[] | null>(null)

  const { focusedNodeId, filters, focusRecord, clearFocus, lang } = useStore(
    useShallow(s => ({
      focusedNodeId: s.focusedNodeId,
      filters: s.filters,
      focusRecord: s.focusRecord,
      clearFocus: s.clearFocus,
      lang: s.lang,
    }))
  )
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('onboarding-seen'))


  // Keep a ref in sync for use inside stable callbacks
  useEffect(() => { focusedNodeIdRef.current = focusedNodeId }, [focusedNodeId])

  // ResizeObserver — keeps graph sized to its container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setDimensions({ width, height })
    })
    ro.observe(el)
    const { clientWidth: w, clientHeight: h } = el
    if (w > 0 && h > 0) setDimensions({ width: w, height: h })
    return () => ro.disconnect()
  }, [])

  // Load graph module; clear per-node Three.js cache when mode switches
  useEffect(() => {
    setGraphMod(null)
    nodeObjectCache.current.clear()
    linkObjectCache.current.clear()
    const loader = is3D ? import('react-force-graph-3d') : import('react-force-graph-2d')
    loader.then(mod => setGraphMod(mod as GraphModule))
  }, [is3D])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') isShiftPressedRef.current = true
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') isShiftPressedRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      isShiftPressedRef.current = false
    }
  }, [])

  const { nodes: filteredNodes, edges } = useMemo(
    () => buildGraphData(
      data,
      filters.categories,
      filters.surahFrom,
      filters.surahTo,
      filters.ayahFrom,
      filters.ayahTo
    ),
    [data, filters.categories, filters.surahFrom, filters.surahTo, filters.ayahFrom, filters.ayahTo]
  )

  const { nodes } = useMemo(() => {
    const positioned = filteredNodes.map(n => ({ ...n }))
    const initialLayout = computeInitialLayout(positioned)
    const baseCircles = computeSurahCircles(positioned)
    const saved = loadSavedPositions() ?? {}
    const circles = new Map<number, SurahCircleMeta>()
    for (const circle of baseCircles) {
      circles.set(circle.surah, {
        cx: circle.cx,
        cy: circle.cy,
        radius: circle.radius,
      })
    }
    const bySurah = new Map<number, VerseNode[]>()
    for (const node of positioned) {
      const bucket = bySurah.get(node.surah) ?? []
      bucket.push(node)
      bySurah.set(node.surah, bucket)
    }
    const circleTolerance = 16
    let healedFromInvalidSave = false

    for (const [surah, surahNodes] of bySurah.entries()) {
      const circle = circles.get(surah)
      if (!circle) continue
      const savedNodes = surahNodes
        .map((node) => ({ node, savedPos: saved[node.id] }))
        .filter((entry): entry is { node: VerseNode; savedPos: { x: number; y: number } } => Boolean(entry.savedPos))
      const fallbackEntries = surahNodes
        .map((node) => ({ node, fallback: initialLayout[node.id] }))
        .filter((entry): entry is { node: VerseNode; fallback: { x: number; y: number } } => Boolean(entry.fallback))

      let offsetX = 0
      let offsetY = 0
      let surahSaveValid = false

      if (savedNodes.length > 0 && fallbackEntries.length > 0) {
        const savedCentroid = savedNodes.reduce((agg, entry) => {
          agg.x += entry.savedPos.x
          agg.y += entry.savedPos.y
          return agg
        }, { x: 0, y: 0 })
        savedCentroid.x /= savedNodes.length
        savedCentroid.y /= savedNodes.length

        const fallbackCentroid = fallbackEntries.reduce((agg, entry) => {
          agg.x += entry.fallback.x
          agg.y += entry.fallback.y
          return agg
        }, { x: 0, y: 0 })
        fallbackCentroid.x /= fallbackEntries.length
        fallbackCentroid.y /= fallbackEntries.length

        offsetX = savedCentroid.x - fallbackCentroid.x
        offsetY = savedCentroid.y - fallbackCentroid.y
        const translatedCenterX = circle.cx + offsetX
        const translatedCenterY = circle.cy + offsetY
        surahSaveValid = savedNodes.every((entry) => {
          const dx = entry.savedPos.x - translatedCenterX
          const dy = entry.savedPos.y - translatedCenterY
          return Math.hypot(dx, dy) <= circle.radius + circleTolerance
        })
      }

      if (surahSaveValid) {
        circle.cx += offsetX
        circle.cy += offsetY
        for (const node of surahNodes) {
          const fromStorage = saved[node.id]
          const fallback = initialLayout[node.id]
          if (fromStorage) {
            node.x = fromStorage.x
            node.y = fromStorage.y
          } else if (fallback) {
            node.x = fallback.x + offsetX
            node.y = fallback.y + offsetY
          }
        }
      } else {
        if (savedNodes.length > 0) healedFromInvalidSave = true
        for (const node of surahNodes) {
          const fallback = initialLayout[node.id]
          if (fallback) {
            node.x = fallback.x
            node.y = fallback.y
          }
        }
      }
    }

    for (const node of positioned) {
      // Pin all nodes permanently in deterministic circles.
      node.fx = node.x ?? 0
      node.fy = node.y ?? 0
    }

    surahCirclesRef.current = circles
    pendingHealSaveRef.current = healedFromInvalidSave ? positioned : null

    return { nodes: positioned }
  }, [filteredNodes, layoutVersion])

  useEffect(() => {
    if (!pendingHealSaveRef.current) return
    savePositions(pendingHealSaveRef.current)
    pendingHealSaveRef.current = null
  }, [nodes])

  const triggerNodePulse = useCallback((nodeId: string) => {
    const now = performance.now()
    const connected = edges.filter(e => e.source === nodeId || e.target === nodeId)
    const schedule = new Map<string, number>()
    connected.forEach((edge, idx) => {
      schedule.set(edgeKey(edge.source, edge.target), now + idx * STAGGER_MS)
    })
    pulseScheduleRef.current = schedule
  }, [edges])

  const scheduleSavePositions = useCallback((graphNodes: VerseNode[]) => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      savePositions(graphNodes)
      saveTimerRef.current = null
    }, 250)
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  // Stable graphData — only rebuilt when filters change, not on every render
  const graphData = useMemo(() => ({
    nodes: nodes.map(n => ({ ...n })),
    links: edges.map(e => ({
      source: e.source,
      target: e.target,
      key: edgeKey(e.source, e.target),
      color: CATEGORY_COLORS[e.category] ?? '#8B5CF6',
      category: e.category,
      direction: e.direction,
      role: e.role,
      recordId: e.recordId,
    })),
  }), [nodes, edges])

  const graphData3D = useMemo(() => {
    const fullNodes = graphData.nodes
    const fullLinks = graphData.links
    if (fullNodes.length <= MAX_3D_NODES && fullLinks.length <= MAX_3D_EDGES) return graphData

    const ranked = [...fullNodes].sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0))
    const selectedNodeIds = new Set(ranked.slice(0, MAX_3D_NODES).map(n => n.id))
    const reducedLinks = fullLinks
      .filter(l => selectedNodeIds.has(String(l.source)) && selectedNodeIds.has(String(l.target)))
      .slice(0, MAX_3D_EDGES)
    const linkNodeIds = new Set(reducedLinks.flatMap(l => [String(l.source), String(l.target)]))
    const reducedNodes = ranked.filter(n => linkNodeIds.has(n.id))
    return { nodes: reducedNodes, links: reducedLinks }
  }, [graphData])

  const filterKey = useMemo(
    () => `${filters.categories.slice().sort().join(',')}|${filters.surahFrom}-${filters.surahTo}|${filters.ayahFrom}-${filters.ayahTo}|${is3D ? '3d' : '2d'}`,
    [filters.categories, filters.surahFrom, filters.surahTo, filters.ayahFrom, filters.ayahTo, is3D]
  )

  const activeGraphData = is3D ? graphData3D : graphData
  const isReduced3D = is3D && (
    graphData.nodes.length > graphData3D.nodes.length ||
    graphData.links.length > graphData3D.links.length
  )
  const useLite3D = is3D && activeGraphData.nodes.length > 300

  useSeaEnvironment(is3D && !useLite3D, graphRef, seaEnvironmentRef)
  useSurahArtifacts(is3D && !useLite3D, graphRef, activeGraphData.nodes, surahArtifactRef)

  // Auto-focus + auto-rotate for 3D; poll until the graph is actually rendered
  useEffect(() => {
    if (!graphMod || nodes.length === 0 || !is3D) return
    const topNode = [...activeGraphData.nodes].sort((a, b) => b.degree - a.degree)[0]

    let tries = 0
    const interval = setInterval(() => {
      const g = graphRef.current
      if (!g || typeof g['cameraPosition'] !== 'function') {
        if (++tries > 40) clearInterval(interval)
        return
      }
      clearInterval(interval)

      ;(g['cameraPosition'] as (p: unknown, l: unknown, ms: number) => void)(
        { x: topNode.x ?? 0, y: topNode.y ?? 0, z: 150 },
        topNode,
        1500
      )

      type OC = { autoRotate: boolean; autoRotateSpeed: number; addEventListener: (e: string, cb: () => void) => void; _rotateTimer?: ReturnType<typeof setTimeout> }
      const controlsFn = g['controls'] as (() => OC) | undefined
      const controls = typeof controlsFn === 'function' ? controlsFn() : null
      if (controls) {
        controls.autoRotate = true
        controls.autoRotateSpeed = 0.4
        controls.addEventListener('start', () => {
          controls.autoRotate = false
          clearTimeout(controls._rotateTimer)
        })
        controls.addEventListener('end', () => {
          clearTimeout(controls._rotateTimer)
          controls._rotateTimer = setTimeout(() => { controls.autoRotate = true }, 4000)
        })
      }
    }, 150)

    return () => clearInterval(interval)
  }, [graphMod, is3D, activeGraphData.nodes])

  // Zoom to focused node
  useEffect(() => {
    if (!focusedNodeId || !graphRef.current) return
    const node = activeGraphData.nodes.find(n => n.id === focusedNodeId)
    if (!node) return
    node.fx = node.x; node.fy = node.y
    const g = graphRef.current
    if (is3D && typeof g['cameraPosition'] === 'function') {
      ;(g['cameraPosition'] as (p: unknown, l: unknown, ms: number) => void)(
        { x: node.x ?? 0, y: node.y ?? 0, z: 120 },
        node,
        800
      )
    } else if (!is3D && typeof g['centerAt'] === 'function') {
      ;(g['centerAt'] as (x: number, y: number, ms: number) => void)(node.x ?? 0, node.y ?? 0, 600)
      if (typeof g['zoom'] === 'function') {
        ;(g['zoom'] as (level: number, ms: number) => void)(2.5, 600)
      }
    }
  }, [focusedNodeId, activeGraphData.nodes, is3D])

  useEffect(() => {
    if (focusedNodeId) triggerNodePulse(focusedNodeId)
    if (!focusedNodeId) {
      pulseScheduleRef.current = new Map()
    }
  }, [focusedNodeId, triggerNodePulse])

  // Keep nodes pinned on focus clear; only reset viewport.
  useEffect(() => {
    if (!focusedNodeId) {
      for (const n of activeGraphData.nodes) {
        n.fx = n.x ?? n.fx ?? 0
        n.fy = n.y ?? n.fy ?? 0
        if ('fz' in n) (n as Record<string, unknown>).fz = undefined
      }
      if (!is3D && graphRef.current) {
        const g = graphRef.current
        if (typeof g['zoom'] === 'function') {
          ;(g['zoom'] as (level: number, ms: number) => void)(1, 600)
        }
      }
    }
  }, [focusedNodeId, activeGraphData.nodes, is3D])

  useEffect(() => {
    if (!is3D) return
    if (useLite3D) return
    let raf = 0
    const tick = () => {
      const now = performance.now() * 0.001
      const focusedId = focusedNodeIdRef.current
      const hoveredId = hoveredRef.current
      nodeObjectCache.current.forEach((node, nodeId) => {
        const group = node.group
        const userData = group.userData as { baseScale?: number; phase?: number; anchorY?: number }
        if (!userData.phase) userData.phase = Math.random() * Math.PI * 2
        const phase = userData.phase
        if (!userData.baseScale) userData.baseScale = 0.95 + Math.min(0.25, (group.children.length + 1) * 0.03)
        const breath = 1 + Math.sin(now * 2 + phase) * 0.05
        const ignited = nodeId === focusedId ? 1 : nodeId === hoveredId ? 0.65 : 0.35
        const scale = (userData.baseScale ?? 1) * breath * (1 + ignited * 0.08)
        group.scale.setScalar(scale)
        const anchorY = userData.anchorY ?? group.position.y
        userData.anchorY = anchorY
        group.position.y = anchorY + Math.sin(now * 1.3 + phase) * 0.65
        node.update(now, ignited)
      })
      linkObjectCache.current.forEach(mesh => updateInkThreadTime(mesh, now))
      seaEnvironmentRef.current?.update(now)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [is3D, useLite3D])

  const handleNodeClick = useCallback((node: VerseNode) => {
    const record = data.records.find(r =>
      `${r.verses.primary.surah}:${r.verses.primary.ayah}` === node.id
    ) ?? data.records.find(r =>
      r.verses.related.some(v => `${v.surah}:${v.ayah}` === node.id)
    )
    if (record) focusRecord(record)
    triggerNodePulse(node.id)
    if (showOnboarding) {
      setShowOnboarding(false)
      localStorage.setItem('onboarding-seen', '1')
    }
  }, [data.records, focusRecord, showOnboarding, triggerNodePulse])

  const handleNodeHover = useCallback((node: VerseNode | null) => {
    const nextId = node?.id ?? null
    const prevId = hoveredRef.current
    hoveredRef.current = nextId
    if (node && nextId !== prevId) triggerNodePulse(node.id)
  }, [triggerNodePulse])

  // Stable — uses refs, so focusedNodeId changes don't rebuild the callback
  const nodeCanvasObject = useCallback((n: VerseNode, ctx: CanvasRenderingContext2D, gs: number) => {
    drawGlowNode(
      n,
      ctx,
      gs,
      n.id === focusedNodeIdRef.current,
      n.id === hoveredRef.current,
      performance.now(),
    )
  }, [])

  const nodeThreeObject = useCallback((node: VerseNode): THREE.Group => {
    if (!nodeObjectCache.current.has(node.id)) {
      const inkDrop = createInkDropNode(node.degree, getNodeColor(node))
      inkDrop.group.userData = {
        baseScale: 0.95 + Math.min(0.25, node.degree * 0.03),
        phase: Math.random() * Math.PI * 2,
      }
      nodeObjectCache.current.set(node.id, inkDrop)
    }
    return nodeObjectCache.current.get(node.id)!.group
  }, [])

  const linkThreeObject = useCallback((link: { source: VerseNode | string; target: VerseNode | string; key?: string; color?: string }) => {
    const source = typeof link.source === 'string'
      ? new THREE.Vector3(0, 0, 0)
      : new THREE.Vector3(link.source.x ?? 0, link.source.y ?? 0, link.source.z ?? 0)
    const target = typeof link.target === 'string'
      ? new THREE.Vector3(0, 0, 0)
      : new THREE.Vector3(link.target.x ?? 0, link.target.y ?? 0, link.target.z ?? 0)
    const mesh = createInkThread(source, target, link.color ?? '#D4AF37')
    if (link.key) linkObjectCache.current.set(link.key, mesh)
    return mesh
  }, [])

  const linkPositionUpdate = useCallback((
    obj: THREE.Object3D,
    coords: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }
  ) => {
    if (!(obj instanceof THREE.Mesh)) return
    const source = new THREE.Vector3(coords.start.x, coords.start.y, coords.start.z)
    const target = new THREE.Vector3(coords.end.x, coords.end.y, coords.end.z)
    updateInkThread(obj, source, target)
  }, [])

  const linkCanvasObject = useCallback((
    link: { source: VerseNode; target: VerseNode; color?: string; key?: string; pulseStart?: number; direction?: string; role?: string },
    ctx: CanvasRenderingContext2D
  ) => {
    const { source: start, target: end } = link
    if (!start || !end || typeof start !== 'object' || typeof end !== 'object') return
    const color = link.color ?? '#8B5CF6'

    ctx.save()

    const role = link.role ?? 'mutashabih'
    if (role === 'clarifying') ctx.setLineDash([6, 3])
    else if (role === 'supporting') ctx.setLineDash([2, 3])
    else if (role === 'contextual') ctx.setLineDash([1, 4])
    else ctx.setLineDash([])

    const isGroup = link.direction === 'group'
    const opacity = role === 'contextual' ? '33' : isGroup ? '66' : '55'
    const lw = role === 'contextual' ? 0.6 : isGroup ? 1.3 : 0.9

    ctx.beginPath()
    ctx.moveTo(start.x ?? 0, start.y ?? 0)
    ctx.lineTo(end.x ?? 0, end.y ?? 0)
    ctx.strokeStyle = color + opacity
    ctx.lineWidth = lw
    ctx.stroke()
    ctx.setLineDash([])

    if (link.direction === 'directed') {
      const sx = start.x ?? 0, sy = start.y ?? 0
      const ex = end.x ?? 0, ey = end.y ?? 0
      const dx = ex - sx, dy = ey - sy
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > 0) {
        const ux = dx / len, uy = dy / len
        const arrowLen = 4, arrowW = 2
        const tipX = ex - ux * 5, tipY = ey - uy * 5
        ctx.beginPath()
        ctx.moveTo(tipX, tipY)
        ctx.lineTo(tipX - ux * arrowLen + uy * arrowW, tipY - uy * arrowLen - ux * arrowW)
        ctx.lineTo(tipX - ux * arrowLen - uy * arrowW, tipY - uy * arrowLen + ux * arrowW)
        ctx.closePath()
        ctx.fillStyle = color + '99'
        ctx.fill()
      }
    }

    ctx.restore()

    const pulseStart = link.pulseStart ?? pulseScheduleRef.current.get(link.key ?? '') ?? 0
    if (!pulseStart) return

    const elapsed = performance.now() - pulseStart
    if (elapsed < 0 || elapsed > PULSE_WINDOW_MS) return
    const t = Math.min(1, elapsed / PULSE_WINDOW_MS)
    const x = (start.x ?? 0) + ((end.x ?? 0) - (start.x ?? 0)) * t
    const y = (start.y ?? 0) + ((end.y ?? 0) - (start.y ?? 0)) * t
    const pulseR = 2.4 + Math.sin(t * Math.PI) * 1.8

    ctx.beginPath()
    ctx.moveTo(start.x ?? 0, start.y ?? 0)
    ctx.lineTo(x, y)
    ctx.strokeStyle = 'rgba(245,229,176,0.42)'
    ctx.lineWidth = 1.6
    ctx.stroke()

    const glow = ctx.createRadialGradient(x, y, 0, x, y, pulseR * 4)
    glow.addColorStop(0, 'rgba(252,243,210,0.9)')
    glow.addColorStop(0.3, 'rgba(236,213,140,0.45)')
    glow.addColorStop(1, 'rgba(236,213,140,0)')
    ctx.beginPath()
    ctx.arc(x, y, pulseR * 4, 0, 2 * Math.PI)
    ctx.fillStyle = glow
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, pulseR, 0, 2 * Math.PI)
    ctx.fillStyle = '#fff6d8'
    ctx.fill()
  }, [])

  const handleNodeDrag = useCallback((node: VerseNode, translate?: { x?: number; y?: number }) => {
    if (!isShiftPressedRef.current || !translate) return
    const dx = translate.x ?? 0
    const dy = translate.y ?? 0
    if (dx === 0 && dy === 0) return
    for (const peer of activeGraphData.nodes) {
      if (peer.id === node.id || peer.surah !== node.surah) continue
      peer.x = (peer.x ?? 0) + dx
      peer.y = (peer.y ?? 0) + dy
      peer.fx = peer.x
      peer.fy = peer.y
    }
    const circle = surahCirclesRef.current.get(node.surah)
    if (circle) {
      circle.cx += dx
      circle.cy += dy
    }
  }, [activeGraphData.nodes])

  const handleNodeDragEnd = useCallback((node: VerseNode) => {
    if (!isShiftPressedRef.current) {
      const circle = surahCirclesRef.current.get(node.surah)
      if (circle && typeof node.x === 'number' && typeof node.y === 'number') {
        const dx = node.x - circle.cx
        const dy = node.y - circle.cy
        const distance = Math.hypot(dx, dy)
        const maxDistance = Math.max(0, circle.radius - 6)
        if (distance > maxDistance && distance > 0) {
          const scale = maxDistance / distance
          node.x = circle.cx + dx * scale
          node.y = circle.cy + dy * scale
        }
      }
    }
    node.fx = node.x ?? node.fx ?? 0
    node.fy = node.y ?? node.fy ?? 0
    for (const peer of activeGraphData.nodes) {
      if (peer.id === node.id || peer.surah !== node.surah) continue
      peer.fx = peer.x ?? peer.fx ?? 0
      peer.fy = peer.y ?? peer.fy ?? 0
    }
    scheduleSavePositions(activeGraphData.nodes)
  }, [activeGraphData.nodes, scheduleSavePositions])

  const handleLinkClick = useCallback((link: { recordId?: string }) => {
    if (!link.recordId) return
    const record = data.byId.get(link.recordId)
    if (record) {
      focusRecord(record)
    }
  }, [data.byId, focusRecord])

  const drawSurahCircles = useCallback((ctx: CanvasRenderingContext2D, globalScale: number) => {
    const labels = new Map<number, string>()
    for (const node of activeGraphData.nodes) {
      if (!labels.has(node.surah)) {
        labels.set(node.surah, lang === 'ar' ? node.surahNameAr : node.surahNameEn)
      }
    }
    const fontSize = Math.max(8, 12 / globalScale)
    ctx.save()
    ctx.font = `500 ${fontSize}px Inter, "Noto Sans Arabic", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const [surah, circle] of surahCirclesRef.current.entries()) {
      const label = labels.get(surah) ?? String(surah)
      ctx.beginPath()
      ctx.arc(circle.cx, circle.cy, circle.radius + 6, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(212, 175, 55, 0.03)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.24)'
      ctx.lineWidth = Math.max(0.5, 1 / globalScale)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(5, 10, 21, 0.85)'
      ctx.lineWidth = Math.max(0.8, 1.5 / globalScale)
      ctx.fillStyle = 'rgba(212, 175, 55, 0.55)'
      ctx.strokeText(label, circle.cx, circle.cy)
      ctx.fillText(label, circle.cx, circle.cy)
    }
    ctx.restore()
  }, [activeGraphData.nodes, lang])

    if (!graphMod) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-slate-500 text-sm mb-4">
            {lang === 'ar'
              ? `جاري تحميل محرك الرسم ${is3D ? 'ثلاثي الأبعاد' : 'ثنائي الأبعاد'}…`
              : `Loading ${is3D ? '3D' : '2D'} graph engine…`}
          </div>
          <div className="flex gap-2 justify-center">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: 'linear-gradient(to bottom, #f1d992, #d4af37)',
                  animation: `graphDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const GraphComponent = graphMod.default

  const commonProps: Record<string, unknown> = {
    ref: graphRef,
    graphData: activeGraphData,
    nodeId: 'id',
    nodeLabel: (n: VerseNode) =>
      `${n.surahNameEn} ${n.ayah}${n.uthmaniText ? '\n' + n.uthmaniText.slice(0, 50) + '…' : ''}`,
    nodeColor: (n: VerseNode) => getNodeColor(n),
    nodeVal: (n: VerseNode) => Math.max(2, n.degree) * 3 + 3,
    linkColor: (l: { color?: string }) => l.color ?? '#8B5CF6',
    linkOpacity: 0.5,
    linkWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0)',
    onNodeClick: handleNodeClick,
    onNodeHover: handleNodeHover,
    onNodeDrag: handleNodeDrag,
    onNodeDragEnd: handleNodeDragEnd,
    onLinkClick: handleLinkClick,
    onEngineStop: () => scheduleSavePositions(activeGraphData.nodes),
    onBackgroundClick: () => clearFocus(),
    linkHoverPrecision: 6,
    nodeRelSize: 4,
    enableNodeDrag: true,
    enablePanInteraction: true,
    enableZoomInteraction: true,
    width: dimensions.width,
    height: dimensions.height,
    d3AlphaDecay: 0.015,
    d3VelocityDecay: 0.3,
    cooldownTicks: 300,
    warmupTicks: 30,
  }

  if (is3D) {
    // alpha:true is essential — without it the WebGL canvas is opaque black
    commonProps['rendererConfig'] = { alpha: true, antialias: true }
    if (!useLite3D) {
      commonProps['nodeThreeObject'] = nodeThreeObject
      commonProps['nodeThreeObjectExtend'] = false
      commonProps['linkThreeObject'] = linkThreeObject
      commonProps['linkPositionUpdate'] = linkPositionUpdate
      commonProps['linkOpacity'] = 1
      commonProps['linkWidth'] = 0
      commonProps['linkDirectionalArrowLength'] = (l: { direction?: string }) =>
        l.direction === 'directed' ? 6 : 0
      commonProps['linkDirectionalArrowRelPos'] = 0.9
      commonProps['linkDirectionalArrowColor'] = (l: { color?: string }) => l.color ?? '#8B5CF6'
      commonProps['linkDirectionalParticles'] = (l: { key?: string }) => {
        const pulseStart = pulseScheduleRef.current.get(l.key ?? '') ?? 0
        const elapsed = performance.now() - pulseStart
        return elapsed >= 0 && elapsed <= PULSE_WINDOW_MS ? 2 : 0
      }
      commonProps['linkDirectionalParticleWidth'] = 2.8
      commonProps['linkDirectionalParticleSpeed'] = (l: { key?: string }) => {
        const pulseStart = pulseScheduleRef.current.get(l.key ?? '') ?? 0
        const elapsed = performance.now() - pulseStart
        return elapsed >= 0 && elapsed <= PULSE_WINDOW_MS ? 0.008 : 0
      }
      commonProps['linkDirectionalParticleColor'] = () => '#f6e7b9'
    } else {
      commonProps['linkOpacity'] = 0.5
      commonProps['linkWidth'] = 1
      commonProps['nodeOpacity'] = 0.95
      commonProps['linkDirectionalParticles'] = 0
    }
  } else {
    commonProps['autoPauseRedraw'] = false
    commonProps['nodeCanvasObject'] = nodeCanvasObject
    commonProps['nodeCanvasObjectMode'] = () => 'replace'
    commonProps['linkCanvasObject'] = linkCanvasObject
    commonProps['linkCanvasObjectMode'] = () => 'replace'
    commonProps['onRenderFramePost'] = drawSurahCircles
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {isReduced3D && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full text-xs"
          style={{
            background: 'rgba(5,6,12,0.8)',
            border: '1px solid rgba(212,175,55,0.35)',
            color: '#d9c38a',
          }}
        >
          {lang === 'ar'
            ? `عرض ثلاثي مبسط: ${activeGraphData.nodes.length}/${graphData.nodes.length} عقد`
            : `Reduced 3D mode: ${activeGraphData.nodes.length}/${graphData.nodes.length} nodes`}
        </div>
      )}
      {focusedNodeId && (
        <button
          onClick={clearFocus}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs text-slate-300 hover:text-white transition-all"
          style={{
            background: 'rgba(5,6,12,0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.border = '1px solid rgba(212,175,55,0.4)'
            e.currentTarget.style.background = 'rgba(212,175,55,0.1)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'
            e.currentTarget.style.background = 'rgba(5,6,12,0.8)'
          }}
        >
          ← Back
        </button>
      )}

      <button
        onClick={() => setIs3D(v => !v)}
        className="absolute bottom-4 right-4 z-20 px-3.5 py-1.5 rounded-full text-xs text-slate-400 hover:text-white transition-all"
        style={{
          background: 'rgba(5,6,12,0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.border = '1px solid rgba(212,175,55,0.3)'
          e.currentTarget.style.background = 'rgba(212,175,55,0.08)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'
          e.currentTarget.style.background = 'rgba(5,6,12,0.8)'
        }}
      >
        {is3D ? (lang === 'ar' ? 'ثنائي' : '2D') : (lang === 'ar' ? 'ثلاثي' : '3D')}
      </button>

      <button
        onClick={() => {
          clearSavedPositions()
          setLayoutVersion(v => v + 1)
        }}
        className="absolute bottom-4 right-24 z-20 px-3.5 py-1.5 rounded-full text-xs text-slate-400 hover:text-white transition-all"
        style={{
          background: 'rgba(5,6,12,0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.border = '1px solid rgba(212,175,55,0.3)'
          e.currentTarget.style.background = 'rgba(212,175,55,0.08)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'
          e.currentTarget.style.background = 'rgba(5,6,12,0.8)'
        }}
      >
        {lang === 'ar' ? 'إعادة التخطيط' : 'Reset Layout'}
      </button>

      <GraphComponent key={filterKey} {...commonProps} />

      {showOnboarding && nodes.length > 0 && (
        <OnboardingTooltip onDismiss={() => {
          setShowOnboarding(false)
          localStorage.setItem('onboarding-seen', '1')
        }} />
      )}
    </div>
  )
}

// Add and remove in-scene sea particles/fog for 3D mode.
// Polling is needed because react-force-graph initializes scene asynchronously.
function useSeaEnvironment(
  is3D: boolean,
  graphRef: MutableRefObject<Record<string, unknown> | null>,
  seaEnvironmentRef: MutableRefObject<SeaEnvironment | null>,
) {
  useEffect(() => {
    if (!is3D) {
      seaEnvironmentRef.current?.dispose()
      seaEnvironmentRef.current = null
      return
    }

    let tries = 0
    const timer = window.setInterval(() => {
      const graph = graphRef.current
      if (!graph) return
      const sceneFn = graph['scene'] as (() => THREE.Scene) | undefined
      if (typeof sceneFn !== 'function') {
        tries += 1
        if (tries > 30) window.clearInterval(timer)
        return
      }
      const scene = sceneFn()
      if (!seaEnvironmentRef.current) seaEnvironmentRef.current = createSeaEnvironment(scene)
      window.clearInterval(timer)
    }, 150)

    return () => {
      window.clearInterval(timer)
      seaEnvironmentRef.current?.dispose()
      seaEnvironmentRef.current = null
    }
  }, [is3D, graphRef, seaEnvironmentRef])
}

function useSurahArtifacts(
  is3D: boolean,
  graphRef: MutableRefObject<Record<string, unknown> | null>,
  nodes: VerseNode[],
  surahArtifactRef: MutableRefObject<Map<number, THREE.Mesh>>,
) {
  useEffect(() => {
    if (!is3D) {
      surahArtifactRef.current.forEach(mesh => {
        mesh.parent?.remove(mesh)
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      })
      surahArtifactRef.current.clear()
      return
    }

    const bySurah = new Map<number, VerseNode[]>()
    nodes.forEach((node) => {
      if (!bySurah.has(node.surah)) bySurah.set(node.surah, [])
      bySurah.get(node.surah)!.push(node)
    })
    const activeSurahs = Array.from(bySurah.entries())
      .filter(([, group]) => group.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 12)
      .map(([surah]) => surah)
    const activeSurahSet = new Set(activeSurahs)

    let tries = 0
    let scene: THREE.Scene | null = null
    const sceneTimer = window.setInterval(() => {
      const graph = graphRef.current
      if (!graph) return
      const sceneFn = graph['scene'] as (() => THREE.Scene) | undefined
      if (typeof sceneFn !== 'function') {
        tries += 1
        if (tries > 30) window.clearInterval(sceneTimer)
        return
      }
      scene = sceneFn()
      window.clearInterval(sceneTimer)

      activeSurahs.forEach((surah, index) => {
        if (surahArtifactRef.current.has(surah)) return
        const radius = 18 + (index % 5) * 4
        const mesh = new THREE.Mesh(
          new THREE.RingGeometry(radius, radius + 1.1, 24),
          new THREE.MeshBasicMaterial({
            color: 0xd4af37,
            transparent: true,
            opacity: 0.16,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        )
        mesh.renderOrder = 1
        scene?.add(mesh)
        surahArtifactRef.current.set(surah, mesh)
      })

      Array.from(surahArtifactRef.current.entries()).forEach(([surah, mesh]) => {
        if (!activeSurahSet.has(surah)) {
          mesh.parent?.remove(mesh)
          mesh.geometry.dispose()
          ;(mesh.material as THREE.Material).dispose()
          surahArtifactRef.current.delete(surah)
        }
      })
    }, 120)

    const positionTimer = window.setInterval(() => {
      surahArtifactRef.current.forEach((mesh, surah) => {
        const group = bySurah.get(surah)
        if (!group || group.length === 0) return
        let sx = 0
        let sy = 0
        let sz = 0
        let count = 0
        group.forEach((node) => {
          if (typeof node.x !== 'number' || typeof node.y !== 'number') return
          sx += node.x
          sy += node.y
          sz += node.z ?? 0
          count += 1
        })
        if (count === 0) return
        mesh.position.set(sx / count, sy / count, sz / count)
        mesh.rotation.z += 0.003
      })
    }, 80)

    return () => {
      window.clearInterval(sceneTimer)
      window.clearInterval(positionTimer)
    }
  }, [is3D, graphRef, nodes, surahArtifactRef])
}

function buildGraphData(
  data: DerivedData,
  categoryFilter: string[],
  surahFrom: number,
  surahTo: number,
  ayahFrom: number,
  ayahTo: number
) {
  let nodes = data.nodes
  let edges = data.edges

  if (categoryFilter.length > 0) {
    edges = edges.filter(e => categoryFilter.includes(e.category))
    const nodeIds = new Set(edges.flatMap(e => [e.source, e.target]))
    nodes = nodes.filter(n => nodeIds.has(n.id))
  }

  if (surahFrom > 1 || surahTo < 114) {
    nodes = nodes.filter(n => n.surah >= surahFrom && n.surah <= surahTo)
    const nodeIds = new Set(nodes.map(n => n.id))
    edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
  }

  if (ayahFrom > 1 || ayahTo < 286) {
    nodes = nodes.filter(n => n.ayah >= ayahFrom && n.ayah <= ayahTo)
    const nodeIds = new Set(nodes.map(n => n.id))
    edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
  }

  return { nodes, edges }
}
