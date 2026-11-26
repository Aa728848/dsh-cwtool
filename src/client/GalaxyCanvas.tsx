import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { ParsedSystem, StaticGalaxyParseResult } from 'cwtools-shared/editors'
import css from './GalaxyCanvas.module.css'

/** One committed numeric move of a single system node. */
export interface GalaxyMove { readonly nodeKey: string; readonly x: number; readonly y: number }

export interface GalaxyCanvasProps {
  /** Parsed static galaxy; the first scenario is rendered. */
  readonly galaxy: StaticGalaxyParseResult
  /** Selected system identified by its stable `nodeKey`. */
  readonly selectedNode?: string
  /** Selection notification; the canvas never mutates the parse result. */
  readonly onSelect?: (nodeKey: string, system: ParsedSystem) => void
  /** Fires exactly once per gesture that produced a real numeric move. */
  readonly onCommit: (move: GalaxyMove) => void
  /** Exposes the mounted SVG root (e.g. for screenshot capture). */
  readonly svgRef?: (element: SVGSVGElement | null) => void
  /** Upper bound on how many systems are drawn (largest first N in source order). */
  readonly maxSystems?: number
  /** Inclusive clamp applied to committed world coordinates. */
  readonly minCoordinate?: number
  readonly maxCoordinate?: number
  readonly viewWidth?: number
  readonly viewHeight?: number
  readonly ariaLabel?: string
}

interface Placement { readonly system: ParsedSystem; readonly wx: number; readonly wy: number }
interface DragState { readonly pointerId: number; readonly nodeKey: string; readonly sx: number; readonly sy: number; readonly ox: number; readonly oy: number }
interface Draft { readonly nodeKey: string; readonly x: number; readonly y: number }

const PAD = 44
const axisValue = (axis: { value?: number } | undefined): number | undefined =>
  typeof axis?.value === 'number' && Number.isFinite(axis.value) ? axis.value : undefined

export function GalaxyCanvas({
  galaxy, selectedNode, onSelect, onCommit, svgRef,
  maxSystems = 2000, minCoordinate = -10000, maxCoordinate = 10000,
  viewWidth = 800, viewHeight = 580, ariaLabel = 'Static galaxy drag canvas',
}: GalaxyCanvasProps) {
  const rootRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<DragState | undefined>(undefined)
  const draftRef = useRef<Draft | undefined>(undefined)
  const [drag, setDrag] = useState<DragState | undefined>(undefined)
  const [draft, setDraft] = useState<Draft | undefined>(undefined)

  const model = useMemo(() => {
    const scenario = galaxy.scenarios[0]
    const usable = (scenario?.systems ?? [])
      .map(system => ({ system, wx: axisValue(system.x), wy: axisValue(system.y) }))
      .filter((entry): entry is Placement => entry.wx !== undefined && entry.wy !== undefined)
      .slice(0, Math.max(0, maxSystems))
    const xs = usable.map(entry => entry.wx)
    const ys = usable.map(entry => entry.wy)
    let minX = xs.length > 0 ? Math.min(...xs) : 0
    let maxX = xs.length > 0 ? Math.max(...xs) : 1
    let minY = ys.length > 0 ? Math.min(...ys) : 0
    let maxY = ys.length > 0 ? Math.max(...ys) : 1
    if (minX === maxX) { minX -= 1; maxX += 1 }
    if (minY === maxY) { minY -= 1; maxY += 1 }
    const byId = new Map<string, Placement>(usable.map(entry => [entry.system.id, entry] as const))
    const lanes = (scenario?.hyperlanes ?? [])
      .filter(lane => lane.kind === 'add' && byId.has(lane.fromId) && byId.has(lane.toId))
      .slice(0, 4000)
    return { placements: usable, byId, lanes, minX, maxX, minY, maxY }
  }, [galaxy, maxSystems])

  const { placements, byId, lanes, minX, maxX, minY, maxY } = model
  const innerW = Math.max(1, viewWidth - PAD * 2)
  const innerH = Math.max(1, viewHeight - PAD * 2)
  const toView = (wx: number, wy: number) => ({
    x: PAD + ((wx - minX) / (maxX - minX)) * innerW,
    y: PAD + ((wy - minY) / (maxY - minY)) * innerH,
  })
  const clamp = (value: number) => Math.max(minCoordinate, Math.min(maxCoordinate, Math.round(value)))

  const pointerView = (clientX: number, clientY: number) => {
    const svg = rootRef.current
    if (svg === null) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: rect.width === 0 ? 0 : ((clientX - rect.left) * viewWidth) / rect.width,
      y: rect.height === 0 ? 0 : ((clientY - rect.top) * viewHeight) / rect.height,
    }
  }

  const start = (event: ReactPointerEvent<SVGGElement>, placement: Placement) => {
    event.stopPropagation()
    try { event.currentTarget.setPointerCapture?.(event.pointerId) } catch { /* jsdom lacks capture */ }
    const point = pointerView(event.clientX, event.clientY)
    const state: DragState = {
      pointerId: event.pointerId,
      nodeKey: placement.system.nodeKey,
      sx: point.x, sy: point.y,
      ox: clamp(placement.wx), oy: clamp(placement.wy),
    }
    dragRef.current = state
    draftRef.current = undefined
    setDrag(state)
    setDraft(undefined)
    onSelect?.(placement.system.nodeKey, placement.system)
  }

  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = dragRef.current
    if (current === undefined) return
    if (event.pointerId !== undefined && current.pointerId !== undefined && event.pointerId !== current.pointerId) return
    const point = pointerView(event.clientX, event.clientY)
    const nx = clamp(current.ox + ((point.x - current.sx) * (maxX - minX)) / innerW)
    const ny = clamp(current.oy + ((point.y - current.sy) * (maxY - minY)) / innerH)
    const next: Draft = { nodeKey: current.nodeKey, x: nx, y: ny }
    draftRef.current = next
    setDraft(next)
  }

  const finish = (pointerId: number | undefined, commit: boolean) => {
    const current = dragRef.current
    if (current === undefined) return
    if (pointerId !== undefined && current.pointerId !== undefined && pointerId !== current.pointerId) return
    const pending = draftRef.current
    dragRef.current = undefined
    draftRef.current = undefined
    setDrag(undefined)
    setDraft(undefined)
    if (commit && pending !== undefined && (pending.x !== current.ox || pending.y !== current.oy)) {
      onCommit({ nodeKey: current.nodeKey, x: pending.x, y: pending.y })
    }
  }

  const finishRef = useRef(finish)
  finishRef.current = finish
  useEffect(() => {
    if (drag === undefined) return
    const onUp = (event: PointerEvent) => finishRef.current(event.pointerId, true)
    const onCancel = (event: PointerEvent) => finishRef.current(event.pointerId, false)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [drag])

  const keyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (selectedNode === undefined) return
    const directions: Record<string, readonly [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    }
    const direction = directions[event.key]
    if (direction === undefined) return
    const placement = placements.find(entry => entry.system.nodeKey === selectedNode)
    if (placement === undefined) return
    event.preventDefault()
    const step = event.altKey ? 10 : 1
    const nx = clamp(clamp(placement.wx) + direction[0] * step)
    const ny = clamp(clamp(placement.wy) + direction[1] * step)
    if (nx === clamp(placement.wx) && ny === clamp(placement.wy)) return
    onCommit({ nodeKey: selectedNode, x: nx, y: ny })
  }

  const selected = placements.find(entry => entry.system.nodeKey === selectedNode)
  const selectedDraft = selected !== undefined && draft?.nodeKey === selected.system.nodeKey ? draft : undefined
  const statusPoint = selected === undefined ? undefined : toView(selectedDraft?.x ?? selected.wx, selectedDraft?.y ?? selected.wy)

  return (
    <svg
      ref={element => { rootRef.current = element; svgRef?.(element) }}
      className={css.canvas}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      tabIndex={0}
      role='img'
      aria-label={ariaLabel}
      onKeyDown={keyboard}
      onPointerMove={move}
      onPointerUp={event => finish(event.pointerId, true)}
      onPointerCancel={event => finish(event.pointerId, false)}
    >
      <rect width={viewWidth} height={viewHeight} className={css.space} />
      {lanes.map((lane, index) => {
        const from = byId.get(lane.fromId)!, to = byId.get(lane.toId)!
        const a = toView(from.wx, from.wy), b = toView(to.wx, to.wy)
        return <line key={`lane-${index}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={css.lane} />
      })}
      {placements.map(placement => {
        const preview = draft?.nodeKey === placement.system.nodeKey ? draft : undefined
        const point = toView(preview?.x ?? placement.wx, preview?.y ?? placement.wy)
        const active = placement.system.nodeKey === selectedNode
        const name = placement.system.name ?? placement.system.id
        return (
          <g key={placement.system.nodeKey} className={css.nodeGroup} onPointerDown={event => start(event, placement)}>
            <circle cx={point.x} cy={point.y} r={active ? 7 : 6} className={active ? css.selected : css.node} />
            {active && <circle cx={point.x} cy={point.y} r={13} className={css.ring} />}
            <text x={point.x + 10} y={point.y - 8} className={css.label}>{name}</text>
            <title>{name} · {placement.system.nodeKey}</title>
          </g>
        )
      })}
      {selected !== undefined && statusPoint !== undefined && (
        <text x={12} y={viewHeight - 10} className={css.status}>
          {selected.system.name ?? selected.system.id} · x {selectedDraft?.x ?? selected.wx} · y {selectedDraft?.y ?? selected.wy}
        </text>
      )}
    </svg>
  )
}