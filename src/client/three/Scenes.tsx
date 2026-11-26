/**
 * React scene components: EntityScene, ParticleScene and ShipScene.
 *
 * Each mounts a real WebGL `SceneHost` into a sized container, builds its content
 * from the supplied entity/particle/ship data, and disposes the host on unmount.
 * When the environment cannot provide a WebGL context the component degrades to
 * a labelled placeholder instead of throwing.
 */
import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react'
import type { EntitySceneProps, ParticleSceneProps, ResolvedShipSceneProps, SceneViewOptions, ShipSceneProps } from './types.ts'
import { SceneHost, WebGLUnavailableError } from './sceneHost.ts'
import { buildEntityObject, buildResolvedShipObject, buildShipObject, disposeObject3D } from './entityBuilder.ts'

type SceneStatus =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly notes: readonly string[] }
  | { readonly kind: 'unavailable'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string }

const CONTAINER_STYLE = { width: '100%', height: '100%', minHeight: 240, position: 'relative' } as const
const OVERLAY_STYLE = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, textAlign: 'center', color: '#c8ccd4', font: '12px/1.5 system-ui, sans-serif', pointerEvents: 'none' } as const

function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error) }

/** Create one SceneHost for the component lifetime; return it plus reactive state. */
function useSceneHost(
  container: RefObject<HTMLDivElement | null>,
  view: SceneViewOptions,
  defaultAnimate: boolean,
): { hostRef: MutableRefObject<SceneHost | null>; status: SceneStatus; setStatus: (next: SceneStatus) => void } {
  const hostRef = useRef<SceneHost | null>(null)
  const [status, setStatus] = useState<SceneStatus>({ kind: 'loading' })
  useEffect(() => {
    const element = container.current
    if (element === null) return
    let host: SceneHost
    try {
      host = new SceneHost(element, { ...view, animate: view.animate ?? defaultAnimate })
    } catch (error) {
      const unavailable = error instanceof WebGLUnavailableError
      setStatus(unavailable
        ? { kind: 'unavailable', message: 'WebGL is unavailable in this environment; the 3D preview cannot render.' }
        : { kind: 'error', message: messageOf(error) })
      return
    }
    hostRef.current = host
    return () => { host.dispose(); hostRef.current = null }
    // Mount-time options only; later option changes are ignored by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { hostRef, status, setStatus }
}

function Overlay({ status }: { status: SceneStatus }) {
  if (status.kind === 'ready') {
    if (status.notes.length === 0) return null
    return <div style={OVERLAY_STYLE} data-scene-notes>{status.notes.join(' · ')}</div>
  }
  const label = status.kind === 'loading' ? 'Preparing 3D scene…' : status.message
  return <div style={OVERLAY_STYLE} data-scene-status={status.kind}>{label}</div>
}

/** Entity preview: one `EntityDefinition` mesh with orbit controls. */
export function EntityScene({ entity, loader, assets, ...view }: EntitySceneProps) {
  const container = useRef<HTMLDivElement>(null)
  const { hostRef, status, setStatus } = useSceneHost(container, view, false)
  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    let cancelled = false
    setStatus({ kind: 'loading' })
    buildEntityObject(entity, assets?.[entity.name], loader).then((built) => {
      if (cancelled) { disposeObject3D(built.group); return }
      host.setMeshObject(built.group)
      setStatus({ kind: 'ready', notes: built.notes })
    }).catch((error: unknown) => { if (!cancelled) setStatus({ kind: 'error', message: messageOf(error) }) })
    return () => { cancelled = true }
  }, [entity, loader, assets, hostRef, setStatus])
  return <div ref={container} className={view.className} style={CONTAINER_STYLE}><Overlay status={status} /></div>
}

/** Ship preview: several placed entity sections composed into one model. */
export function ShipScene({ ship, loader, assets, ...view }: ShipSceneProps) {
  const container = useRef<HTMLDivElement>(null)
  const { hostRef, status, setStatus } = useSceneHost(container, view, false)
  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    let cancelled = false
    setStatus({ kind: 'loading' })
    buildShipObject(ship, assets, loader).then((built) => {
      if (cancelled) { disposeObject3D(built.group); return }
      host.setMeshObject(built.group)
      setStatus({ kind: 'ready', notes: built.notes })
    }).catch((error: unknown) => { if (!cancelled) setStatus({ kind: 'error', message: messageOf(error) }) })
    return () => { cancelled = true }
  }, [ship, loader, assets, hostRef, setStatus])
  return <div ref={container} className={view.className} style={CONTAINER_STYLE}><Overlay status={status} /></div>
}

/** Full Host-resolved ship mesh/attachment graph. */
export function ResolvedShipScene({ assets, loader, ...view }: ResolvedShipSceneProps) {
  const container = useRef<HTMLDivElement>(null)
  const { hostRef, status, setStatus } = useSceneHost(container, view, false)
  useEffect(() => {
    const host = hostRef.current; if (host === null) return
    let cancelled = false; setStatus({ kind: 'loading' })
    buildResolvedShipObject(assets, loader).then(built => {
      if (cancelled) { disposeObject3D(built.group); return }
      host.setMeshObject(built.group); setStatus({ kind: 'ready', notes: built.notes })
    }).catch((error: unknown) => { if (!cancelled) setStatus({ kind: 'error', message: messageOf(error) }) })
    return () => { cancelled = true }
  }, [assets, loader, hostRef, setStatus])
  return <div ref={container} className={view.className} style={CONTAINER_STYLE}><Overlay status={status} /></div>
}

/** Particle preview: seeded approximate simulation, clearly labelled as such. */
export function ParticleScene({ effect, textures, seed = 1, ...view }: ParticleSceneProps) {
  const container = useRef<HTMLDivElement>(null)
  const { hostRef, status, setStatus } = useSceneHost(container, view, true)
  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    setStatus({ kind: 'loading' })
    try {
      host.setParticle(effect, textures ?? {}, seed)
      host.play()
      setStatus({ kind: 'ready', notes: ['Approximate simulation — seeded, not engine-exact.'] })
    } catch (error) {
      setStatus({ kind: 'error', message: messageOf(error) })
    }
  }, [effect, textures, seed, hostRef, setStatus])
  return <div ref={container} className={view.className} style={CONTAINER_STYLE}><Overlay status={status} /></div>
}