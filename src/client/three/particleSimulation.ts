import type { AnimationCurve, AnimatedValue, Force, ParticleEffect, Scalar, Subsystem } from 'cwtools-shared/editors'
import { isRange } from 'cwtools-shared/editors'

/**
 * Seeded, deterministic particle approximation.
 *
 * This is NOT Stellaris' runtime particle solver. It samples the parsed
 * `subsystem`/`animation`/`force` blocks with seeded pseudo-randomness and a few
 * empirically tuned constants so previews are stable frame-to-frame and across
 * reloads, and every value is explicitly presented as an approximation in the UI.
 */

export interface ParticleInstanceData {
  count: number
  positions: Float32Array
  trailTails: Float32Array
  sizes: Float32Array
  rotations: Float32Array
  rights: Float32Array
  ups: Float32Array
  colors: Float32Array
  frames: Float32Array
}

export interface CurvePoint { readonly x: number; readonly y: number }

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)) }

/** Monotone cubic (Fritsch–Carlson) curve evaluation shared with the webview editor. */
export function evalCurve(points: readonly CurvePoint[], t: number): number {
  if (points.length === 0) return 1
  const sorted = points.map((point) => ({ x: clamp01(point.x), y: point.y })).sort((a, b) => a.x - b.x)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first === undefined || last === undefined) return 1
  if (t <= first.x) return first.y
  if (t >= last.x) return last.y
  if (sorted.length === 1) return first.y
  const n = sorted.length
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (a === undefined || b === undefined) continue
    const span = Math.max(1e-6, b.x - a.x)
    dx.push(span)
    slope.push((b.y - a.y) / span)
  }
  const tangent = new Array<number>(n).fill(0)
  tangent[0] = slope[0] ?? 0
  tangent[n - 1] = slope[n - 2] ?? 0
  for (let i = 1; i < n - 1; i++) {
    const prev = slope[i - 1] ?? 0
    const next = slope[i] ?? 0
    if (prev * next <= 0) { tangent[i] = 0; continue }
    const w1 = 2 * (dx[i] ?? 1) + (dx[i - 1] ?? 1)
    const w2 = (dx[i] ?? 1) + 2 * (dx[i - 1] ?? 1)
    tangent[i] = (w1 + w2) / (w1 / prev + w2 / next)
  }
  for (let i = 0; i < n - 1; i++) {
    const m = slope[i] ?? 0
    if (Math.abs(m) < 1e-6) { tangent[i] = 0; tangent[i + 1] = 0; continue }
    const a = (tangent[i] ?? 0) / m
    const b = (tangent[i + 1] ?? 0) / m
    const sum = a * a + b * b
    if (sum > 9) {
      const tau = 3 / Math.sqrt(sum)
      tangent[i] = tau * a * m
      tangent[i + 1] = tau * b * m
    }
  }
  let index = 0
  for (let i = 0; i < n - 1; i++) {
    const a = sorted[i]; const b = sorted[i + 1]
    if (a !== undefined && b !== undefined && t >= a.x && t <= b.x) { index = i; break }
  }
  const h = dx[index] ?? 1
  const base = sorted[index]
  const next = sorted[index + 1]
  if (base === undefined || next === undefined) return 1
  const localT = (t - base.x) / h
  const h00 = 2 * localT ** 3 - 3 * localT ** 2 + 1
  const h10 = localT ** 3 - 2 * localT ** 2 + localT
  const h01 = -2 * localT ** 3 + 3 * localT ** 2
  const h11 = localT ** 3 - localT ** 2
  return h00 * base.y + h10 * h * (tangent[index] ?? 0) + h01 * next.y + h11 * h * (tangent[index + 1] ?? 0)
}

interface AnimationSampleContext { lifeProgress: number; particleAge: number; lifeSeconds: number; systemAge: number }
type ForceMap = Record<string, Force>

const FRICTION_RESPONSE_SCALE = 2.5

function seeded(seed: number, salt: number): number {
  let value = (seed + 0x9e3779b9 + salt * 2654435761) >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  return ((value >>> 0) % 10000) / 10000
}

function degToRad(value: number): number { return value * Math.PI / 180 }

function animatedValue(value: AnimatedValue, progress: number, curves: Map<string, AnimationCurve>, context?: AnimationSampleContext): number {
  const primary = value.raw !== undefined && !isNumericCellText(value.raw) ? curves.get(value.raw) : undefined
  if (primary !== undefined) return animationCurveValue(primary, progress, context)
  const curve = value.curve !== undefined ? curves.get(value.curve) : undefined
  if (curve === undefined) return value.value
  const raw = rawAnimationCurveValue(curve, progress, context)
  if (curve.op === 'MUL' || curve.op === 'mul') return value.value * raw
  return curve.minValue + (curve.maxValue - curve.minValue) * raw
}

function isNumericCellText(text: string): boolean { return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?$/i.test(text.trim()) }

function animationCurveValue(curve: AnimationCurve, progress: number, context?: AnimationSampleContext): number {
  const raw = rawAnimationCurveValue(curve, progress, context)
  if (curve.op === 'MUL' || curve.op === 'mul') return raw
  return curve.minValue + (curve.maxValue - curve.minValue) * raw
}

function rawAnimationCurveValue(curve: AnimationCurve, progress: number, context?: AnimationSampleContext): number {
  const sourceTime = animationSourceTime(curve, progress, context)
  const duration = curve.duration > 0 ? curve.duration : 1
  let localT = (sourceTime - curve.start) / duration
  if (curve.repeat && sourceTime >= curve.start) localT = ((sourceTime - curve.start) % duration) / duration
  localT = clamp01(localT)
  return evalCurve(curve.points, localT)
}

function animationSourceTime(curve: AnimationCurve, progress: number, context?: AnimationSampleContext): number {
  if (context === undefined) return progress
  switch (curve.time.toLowerCase()) {
    case 'system': return context.systemAge
    case 'life_abs': return context.particleAge
    case 'spawn': return Math.max(0, context.systemAge - context.particleAge)
    default: return context.lifeProgress
  }
}

function scalarValueAt(value: Scalar | undefined, fallback: number, progress: number, seed: number, curves: Map<string, AnimationCurve>, context?: AnimationSampleContext): number {
  if (value === undefined) return fallback
  if (isRange(value)) {
    const base = animatedValue(value.a, progress, curves, context)
    const variance = Math.abs(animatedValue(value.b, progress, curves, context))
    return base + (seeded(seed, 11) * 2 - 1) * variance
  }
  return animatedValue(value, progress, curves, context)
}

function rangeMagnitude(value: Scalar | undefined, progress: number, curves: Map<string, AnimationCurve>, context?: AnimationSampleContext): number {
  if (value === undefined || !isRange(value)) return 0
  const values = [value.b, ...(value.extras ?? [])]
  return values.reduce((max, item) => Math.max(max, Math.abs(animatedValue(item, progress, curves, context))), 0)
}

function directionFromYawPitch(yawDeg: number, pitchDeg: number): [number, number, number] {
  const yaw = degToRad(yawDeg); const pitch = degToRad(pitchDeg); const cp = Math.cos(pitch)
  return [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp]
}

function assetVectorToWorld(vector: [number, number, number]): [number, number, number] {
  return [vector[2], vector[1], -vector[0]]
}

function normalize3(vector: [number, number, number], fallback: [number, number, number] = [0, 1, 0]): [number, number, number] {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (length <= 0.00001) return fallback
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function rotateYawVector(vector: [number, number, number], yawDeg: number): [number, number, number] {
  const yaw = degToRad(yawDeg); const c = Math.cos(yaw); const s = Math.sin(yaw)
  return [vector[0] * c + vector[2] * s, vector[1], -vector[0] * s + vector[2] * c]
}

function cross3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function forceReferenceNames(value: string | undefined): string[] {
  return (value ?? '').split(',').map((name) => name.trim().replace(/^"|"$/g, '')).filter(Boolean)
}

function makeBuffer(capacity: number): ParticleInstanceData {
  return {
    count: 0,
    positions: new Float32Array(capacity * 3),
    trailTails: new Float32Array(capacity * 3),
    sizes: new Float32Array(capacity),
    rotations: new Float32Array(capacity),
    rights: new Float32Array(capacity * 3),
    ups: new Float32Array(capacity * 3),
    colors: new Float32Array(capacity * 4),
    frames: new Float32Array(capacity),
  }
}

export class ParticleSystemSim {
  readonly subsystem: Subsystem
  readonly capacity: number
  readonly buffer: ParticleInstanceData
  private readonly curves: Map<string, AnimationCurve>
  private readonly forces: ForceMap
  private readonly active: boolean[]
  private readonly age: Float32Array
  private readonly life: Float32Array
  private readonly seed: Uint32Array
  private readonly px: Float32Array
  private readonly py: Float32Array
  private readonly pz: Float32Array
  private readonly prevPx: Float32Array
  private readonly prevPy: Float32Array
  private readonly prevPz: Float32Array
  private readonly vx: Float32Array
  private readonly vy: Float32Array
  private readonly vz: Float32Array
  private readonly rot: Float32Array
  private readonly rotSpeed: Float32Array
  private readonly spatialScale: number
  private systemAge = 0
  private emissionAcc = 0
  private burstDone = false

  constructor(subsystem: Subsystem, animations: AnimationCurve[], forces: Force[], spatialScale = 1) {
    this.subsystem = subsystem
    this.capacity = Math.max(1, Math.min(2048, subsystem.maxAmount ?? 128))
    this.buffer = makeBuffer(this.capacity)
    this.spatialScale = Math.max(0.001, Math.abs(spatialScale))
    this.curves = new Map(animations.map((curve) => [curve.name, curve]))
    this.forces = Object.fromEntries(forces.map((force) => [force.name, force]))
    this.active = new Array<boolean>(this.capacity).fill(false)
    this.age = new Float32Array(this.capacity)
    this.life = new Float32Array(this.capacity)
    this.seed = new Uint32Array(this.capacity)
    this.px = new Float32Array(this.capacity)
    this.py = new Float32Array(this.capacity)
    this.pz = new Float32Array(this.capacity)
    this.prevPx = new Float32Array(this.capacity)
    this.prevPy = new Float32Array(this.capacity)
    this.prevPz = new Float32Array(this.capacity)
    this.vx = new Float32Array(this.capacity)
    this.vy = new Float32Array(this.capacity)
    this.vz = new Float32Array(this.capacity)
    this.rot = new Float32Array(this.capacity)
    this.rotSpeed = new Float32Array(this.capacity)
  }

  reset(): void {
    this.systemAge = 0; this.emissionAcc = 0; this.burstDone = false
    this.active.fill(false); this.buffer.count = 0
  }

  update(dt: number): void {
    const step = Math.min(0.05, Math.max(0, dt))
    this.systemAge += step
    this.spawn(step)
    this.integrate(step)
    this.writeInstances()
  }

  private spawn(dt: number): void {
    if (this.subsystem.hide) return
    const ctx: AnimationSampleContext = { lifeProgress: 0, particleAge: 0, lifeSeconds: 1, systemAge: this.systemAge }
    const start = scalarValueAt(this.subsystem.start, 0, 0, 3, this.curves, ctx)
    if (this.systemAge < start) return
    const duration = scalarValueAt(this.subsystem.duration, -1, 0, 4, this.curves, ctx)
    const emission = scalarValueAt(this.subsystem.emission, duration === 0 ? this.capacity : 24, 0, 7, this.curves, ctx)
    if (duration === 0) {
      if (this.burstDone) return
      this.burstDone = true
      for (let i = 0; i < Math.min(this.capacity, Math.max(1, Math.round(emission))); i++) this.spawnOne()
      return
    }
    if (duration >= 0 && this.systemAge > start + duration) return
    this.emissionAcc += Math.max(0, emission) * dt
    const count = Math.min(64, Math.floor(this.emissionAcc))
    this.emissionAcc -= count
    for (let i = 0; i < count; i++) this.spawnOne()
  }

  private spawnOne(): void {
    const index = this.active.findIndex((value) => !value)
    if (index < 0) return
    const seed = ((index + 1) * 2654435761 + Math.floor(this.systemAge * 1000)) >>> 0
    this.active[index] = true
    this.seed[index] = seed
    this.age[index] = 0
    const ctx: AnimationSampleContext = { lifeProgress: 0, particleAge: 0, lifeSeconds: 1, systemAge: this.systemAge }
    this.life[index] = Math.max(0.05, scalarValueAt(this.subsystem.life, 1, 0, seed, this.curves, ctx))
    const spawnCtx: AnimationSampleContext = { ...ctx, lifeSeconds: this.life[index] ?? 1 }
    const pos = this.initialPosition(seed, spawnCtx)
    this.px[index] = pos[0]; this.py[index] = pos[1]; this.pz[index] = pos[2]
    this.prevPx[index] = pos[0]; this.prevPy[index] = pos[1]; this.prevPz[index] = pos[2]
    const yaw = scalarValueAt(this.subsystem.velocityYaw, 0, 0, seed + 1, this.curves, spawnCtx) + scalarValueAt(this.subsystem.emitterYaw, 0, 0, seed + 2, this.curves, spawnCtx)
    const pitch = scalarValueAt(this.subsystem.velocityPitch, 0, 0, seed + 3, this.curves, spawnCtx) + scalarValueAt(this.subsystem.emitterPitch, 0, 0, seed + 4, this.curves, spawnCtx)
    const dir = directionFromYawPitch(yaw, pitch)
    const speed = scalarValueAt(this.subsystem.velocity, 1, 0, seed + 5, this.curves, spawnCtx) * this.spatialScale
    this.vx[index] = dir[0] * speed; this.vy[index] = dir[1] * speed; this.vz[index] = dir[2] * speed
    this.rot[index] = degToRad(scalarValueAt(this.subsystem.rotation, 0, 0, seed + 6, this.curves, spawnCtx))
    this.rotSpeed[index] = degToRad(scalarValueAt(this.subsystem.rotationSpeed, 0, 0, seed + 7, this.curves, spawnCtx))
  }

  private initialPosition(seed: number, context: AnimationSampleContext): [number, number, number] {
    const base = assetVectorToWorld([
      scalarValueAt(this.subsystem.position?.x, 0, 0, seed + 10, this.curves, context) * this.spatialScale,
      scalarValueAt(this.subsystem.position?.y, 0, 0, seed + 11, this.curves, context) * this.spatialScale,
      scalarValueAt(this.subsystem.position?.z, 0, 0, seed + 12, this.curves, context) * this.spatialScale,
    ])
    if (this.subsystem.emitterType === 'box') {
      base[2] += scalarValueAt(this.subsystem.boxEmitterX, 0, 0, seed + 13, this.curves, context) * this.spatialScale * (seeded(seed, 14) * 2 - 1)
      base[1] += scalarValueAt(this.subsystem.boxEmitterY, 0, 0, seed + 15, this.curves, context) * this.spatialScale * (seeded(seed, 16) * 2 - 1)
      base[0] += scalarValueAt(this.subsystem.boxEmitterZ, 0, 0, seed + 17, this.curves, context) * this.spatialScale * (seeded(seed, 18) * 2 - 1)
    } else if (this.subsystem.emitterType === 'sphere') {
      const radius = Math.max(0, scalarValueAt(this.subsystem.sphereEmitterRadius, 1, 0, seed + 19, this.curves, context) * this.spatialScale)
      const yaw = seeded(seed, 20) * Math.PI * 2
      const pitch = Math.acos(seeded(seed, 21) * 2 - 1)
      const r = radius * Math.cbrt(seeded(seed, 22))
      base[0] += Math.sin(pitch) * Math.cos(yaw) * r
      base[1] += Math.cos(pitch) * r
      base[2] += Math.sin(pitch) * Math.sin(yaw) * r
    }
    return base
  }

  private forceDirection(force: Force, fallback: [number, number, number] = [0, 1, 0]): [number, number, number] {
    return rotateYawVector(assetVectorToWorld(force.direction ?? fallback), force.yaw ?? 0)
  }

  private forceAxis(force: Force, fallback: [number, number, number] = [0, 1, 0]): [number, number, number] {
    return normalize3(this.forceDirection(force, fallback), fallback)
}

  private forcePosition(force: Force): [number, number, number] {
    const position = rotateYawVector(assetVectorToWorld(force.position ?? [0, 0, 0]), force.yaw ?? 0)
    return [position[0] * this.spatialScale, position[1] * this.spatialScale, position[2] * this.spatialScale]
}

  private spatialForceAmount(force: Force, fallback: number, progress: number, seed: number, context?: AnimationSampleContext): number {
    return scalarValueAt(force.amount, fallback, progress, seed, this.curves, context) * this.spatialScale
}

  private subsystemForces(): Force[] {
    return forceReferenceNames(this.subsystem.force).map((name) => this.forces[name]).filter((force): force is Force => force !== undefined)
}

  private integrate(dt: number): void {
    const activeForces = this.subsystemForces()
    const singleFriction = activeForces.length === 1 && activeForces[0]?.type === 'friction' ? activeForces[0] : undefined
    for (let i = 0; i < this.capacity; i++) {
      if (!this.active[i]) continue
      const nextAge = (this.age[i] ?? 0) + dt
      const life = Math.max(0.001, this.life[i] ?? 1)
      const seed = this.seed[i] ?? 0
      this.age[i] = nextAge
      if (nextAge >= life) { this.active[i] = false; continue }
      const progress = nextAge / life
      const ctx: AnimationSampleContext = { lifeProgress: progress, particleAge: nextAge, lifeSeconds: life, systemAge: this.systemAge }
      const mass = Math.max(0.05, scalarValueAt(this.subsystem.mass, 1, progress, seed + 37, this.curves, ctx))
      const forceDt = dt / mass
      this.prevPx[i] = this.px[i] ?? 0; this.prevPy[i] = this.py[i] ?? 0; this.prevPz[i] = this.pz[i] ?? 0
      let moveVx = this.vx[i] ?? 0; let moveVy = this.vy[i] ?? 0; let moveVz = this.vz[i] ?? 0
      let usedExactFriction = false
      if (singleFriction !== undefined) {
        const amount = Math.max(0, scalarValueAt(singleFriction.amount, 0.2, progress, seed, this.curves, ctx))
        const drag = amount * FRICTION_RESPONSE_SCALE / mass
        const damp = Math.exp(-drag * dt)
        const displacementScale = drag > 0.000001 ? (1 - damp) / (drag * dt) : 1
        moveVx *= displacementScale; moveVy *= displacementScale; moveVz *= displacementScale
        this.vx[i] = (this.vx[i] ?? 0) * damp; this.vy[i] = (this.vy[i] ?? 0) * damp; this.vz[i] = (this.vz[i] ?? 0) * damp
        usedExactFriction = true
      } else {
        const startVx = this.vx[i] ?? 0; const startVy = this.vy[i] ?? 0; const startVz = this.vz[i] ?? 0
        for (const force of activeForces) {
          if (force.type === 'friction') {
            const amount = Math.max(0, scalarValueAt(force.amount, 0.2, progress, seed, this.curves, ctx))
            const damp = Math.exp(-amount * FRICTION_RESPONSE_SCALE * forceDt)
            this.vx[i] = (this.vx[i] ?? 0) * damp; this.vy[i] = (this.vy[i] ?? 0) * damp; this.vz[i] = (this.vz[i] ?? 0) * damp
          } else if (force.type === 'planar') {
            const direction = this.forceDirection(force)
            const amount = this.spatialForceAmount(force, 1, progress, seed, ctx)
            this.vx[i] = (this.vx[i] ?? 0) + (direction[0] ?? 0) * amount * forceDt
            this.vy[i] = (this.vy[i] ?? 0) + (direction[1] ?? 0) * amount * forceDt
            this.vz[i] = (this.vz[i] ?? 0) + (direction[2] ?? 0) * amount * forceDt
          } else if (force.type === 'point') {
            const center = this.forcePosition(force)
            const amount = this.spatialForceAmount(force, 1, progress, seed, ctx)
            const dx = (this.px[i] ?? 0) - center[0]; const dy = (this.py[i] ?? 0) - center[1]; const dz = (this.pz[i] ?? 0) - center[2]
            const radialLength = Math.max(0.001, Math.hypot(dx, dy, dz))
            const falloff = 1 / Math.max(0.25, radialLength / Math.max(1, force.division ?? 16))
            this.vx[i] = (this.vx[i] ?? 0) + dx / radialLength * amount * falloff * forceDt
            this.vy[i] = (this.vy[i] ?? 0) + dy / radialLength * amount * falloff * forceDt
            this.vz[i] = (this.vz[i] ?? 0) + dz / radialLength * amount * falloff * forceDt
          } else if (force.type === 'spin' || force.type === 'vortex') {
            const center = this.forcePosition(force)
            const axis = this.forceAxis(force)
            const amount = this.spatialForceAmount(force, force.type === 'vortex' ? 0.5 : 1, progress, seed, ctx)
            const dx = (this.px[i] ?? 0) - center[0]; const dy = (this.py[i] ?? 0) - center[1]; const dz = (this.pz[i] ?? 0) - center[2]
            const axial = dx * axis[0] + dy * axis[1] + dz * axis[2]
            const tangent = normalize3(cross3(axis, [dx - axis[0] * axial, dy - axis[1] * axial, dz - axis[2] * axial]), [1, 0, 0])
            const radialLength = Math.max(0.001, Math.hypot(dx - axis[0] * axial, dy - axis[1] * axial, dz - axis[2] * axial))
            const strength = amount * Math.max(0.25, radialLength / Math.max(1, force.division ?? 16))
            this.vx[i] = (this.vx[i] ?? 0) + tangent[0] * strength * forceDt
            this.vy[i] = (this.vy[i] ?? 0) + tangent[1] * strength * forceDt
            this.vz[i] = (this.vz[i] ?? 0) + tangent[2] * strength * forceDt
          } else if (force.type === 'turbulence') {
            const amount = this.spatialForceAmount(force, 1, progress, seed, ctx)
            const phase = Math.floor((this.systemAge + progress) * Math.max(1, force.division ?? 8))
            this.vx[i] = (this.vx[i] ?? 0) + (seeded(seed + phase, 41) * 2 - 1) * amount * forceDt
            this.vy[i] = (this.vy[i] ?? 0) + (seeded(seed + phase, 42) * 2 - 1) * amount * forceDt
            this.vz[i] = (this.vz[i] ?? 0) + (seeded(seed + phase, 43) * 2 - 1) * amount * forceDt
          }
        }
        if (activeForces.length > 0) {
          moveVx = (startVx + (this.vx[i] ?? 0)) * 0.5
          moveVy = (startVy + (this.vy[i] ?? 0)) * 0.5
          moveVz = (startVz + (this.vz[i] ?? 0)) * 0.5
        }
      }
      if (!usedExactFriction) {
        moveVx = activeForces.length > 0 ? moveVx : this.vx[i] ?? 0
        moveVy = activeForces.length > 0 ? moveVy : this.vy[i] ?? 0
        moveVz = activeForces.length > 0 ? moveVz : this.vz[i] ?? 0
      }
      this.px[i] = (this.px[i] ?? 0) + moveVx * dt
      this.py[i] = (this.py[i] ?? 0) + moveVy * dt
      this.pz[i] = (this.pz[i] ?? 0) + moveVz * dt
      this.rot[i] = (this.rot[i] ?? 0) + (this.rotSpeed[i] ?? 0) * dt
    }
  }

  private writeInstances(): void {
    let count = 0
    const cols = Math.max(1, this.subsystem.texture?.x ?? 1)
    const rows = Math.max(1, this.subsystem.texture?.y ?? 1)
    const frameCount = cols * rows
    for (let i = 0; i < this.capacity; i++) {
      if (!this.active[i]) continue
      const seed = this.seed[i] ?? 0
      const ageSeconds = this.age[i] ?? 0
      const lifeSeconds = Math.max(0.001, this.life[i] ?? 1)
      const progress = clamp01(ageSeconds / lifeSeconds)
      const ctx: AnimationSampleContext = { lifeProgress: progress, particleAge: ageSeconds, lifeSeconds, systemAge: this.systemAge }
      const posOffset = count * 3
      const colorOffset = count * 4
      this.buffer.positions[posOffset] = this.px[i] ?? 0
      this.buffer.positions[posOffset + 1] = this.py[i] ?? 0
      this.buffer.positions[posOffset + 2] = this.pz[i] ?? 0
      this.buffer.sizes[count] = Math.max(0.001, scalarValueAt(this.subsystem.size, 1, progress, seed + 31, this.curves, ctx) * this.spatialScale)
      this.writeTrailTail(count, i)
      this.buffer.rotations[count] = this.rot[i] ?? 0
      this.writeOrientation(count, progress, seed, ageSeconds, lifeSeconds, ctx)
      this.buffer.colors[colorOffset] = clamp01(scalarValueAt(this.subsystem.color?.r, 255, progress, seed + 32, this.curves, ctx) / 255)
      this.buffer.colors[colorOffset + 1] = clamp01(scalarValueAt(this.subsystem.color?.g, 255, progress, seed + 33, this.curves, ctx) / 255)
      this.buffer.colors[colorOffset + 2] = clamp01(scalarValueAt(this.subsystem.color?.b, 255, progress, seed + 34, this.curves, ctx) / 255)
      this.buffer.colors[colorOffset + 3] = clamp01(scalarValueAt(this.subsystem.color?.alpha, 255, progress, seed + 35, this.curves, ctx) / 255)
      this.buffer.frames[count] = frameCount <= 1 ? 0 : Math.min(frameCount - 1, Math.floor(progress * frameCount))
      count += 1
    }
    this.buffer.count = count
  }

  private writeTrailTail(outputIndex: number, particleIndex: number): void {
    const offset = outputIndex * 3
    const px = this.px[particleIndex] ?? 0; const py = this.py[particleIndex] ?? 0; const pz = this.pz[particleIndex] ?? 0
    if (!this.subsystem.trail) { this.buffer.trailTails[offset] = px; this.buffer.trailTails[offset + 1] = py; this.buffer.trailTails[offset + 2] = pz; return }
    const speed = Math.hypot(this.vx[particleIndex] ?? 0, this.vy[particleIndex] ?? 0, this.vz[particleIndex] ?? 0)
    const age = this.age[particleIndex] ?? 0
    const size = this.buffer.sizes[outputIndex] ?? 1
    if (speed > 0.0001) {
      const length = Math.min(size * 6, speed * Math.min(age, 0.25))
      this.buffer.trailTails[offset] = px - (this.vx[particleIndex] ?? 0) / speed * length
      this.buffer.trailTails[offset + 1] = py - (this.vy[particleIndex] ?? 0) / speed * length
      this.buffer.trailTails[offset + 2] = pz - (this.vz[particleIndex] ?? 0) / speed * length
      return
    }
    this.buffer.trailTails[offset] = this.prevPx[particleIndex] ?? px
    this.buffer.trailTails[offset + 1] = this.prevPy[particleIndex] ?? py
    this.buffer.trailTails[offset + 2] = this.prevPz[particleIndex] ?? pz
  }

  private writeOrientation(index: number, progress: number, seed: number, ageSeconds: number, lifeSeconds: number, ctx: AnimationSampleContext): void {
    const billboard = this.subsystem.billboard !== false
    const yaw = degToRad(scalarValueAt(this.subsystem.particleYaw, 0, progress, seed + 38, this.curves, ctx) + scalarValueAt(this.subsystem.rotationSpeedYaw, 0, progress, seed + 41, this.curves, ctx) * ageSeconds)
    const pitch = degToRad(scalarValueAt(this.subsystem.particlePitch, 0, progress, seed + 39, this.curves, ctx) + scalarValueAt(this.subsystem.rotationSpeedPitch, 0, progress, seed + 42, this.curves, ctx) * ageSeconds)
    const roll = degToRad(scalarValueAt(this.subsystem.particleRoll, 0, progress, seed + 40, this.curves, ctx) + scalarValueAt(this.subsystem.rotationSpeedRoll, 0, progress, seed + 43, this.curves, ctx) * ageSeconds)
    const flutter = this.orientationFlutter(progress, seed, billboard, lifeSeconds, ctx)
    const right: [number, number, number] = [Math.cos(yaw + flutter.yaw), 0, -Math.sin(yaw + flutter.yaw)]
    const upBase: [number, number, number] = [0, 1, 0]
    const cp = Math.cos(pitch + flutter.pitch); const sp = Math.sin(pitch + flutter.pitch)
    const up: [number, number, number] = [upBase[0] * cp - (-right[2]) * sp, upBase[1] * cp, upBase[2] * cp - right[0] * sp]
    const normal = normalize3(cross3(right, up), [0, 0, 1])
    if (Math.abs(roll + flutter.roll) > 0.00001) {
      const angle = roll + flutter.roll; const c = Math.cos(angle); const s = Math.sin(angle)
      const rotate = (v: [number, number, number]): [number, number, number] => [
        v[0] * c + (normal[1] * v[2] - normal[2] * v[1]) * s + normal[0] * (normal[0] * v[0] + normal[1] * v[1] + normal[2] * v[2]) * (1 - c),
        v[1] * c + (normal[2] * v[0] - normal[0] * v[2]) * s + normal[1] * (normal[0] * v[0] + normal[1] * v[1] + normal[2] * v[2]) * (1 - c),
        v[2] * c + (normal[0] * v[1] - normal[1] * v[0]) * s + normal[2] * (normal[0] * v[0] + normal[1] * v[1] + normal[2] * v[2]) * (1 - c),
      ]
      const r2 = rotate(right); const u2 = rotate(up)
      right[0] = r2[0]; right[1] = r2[1]; right[2] = r2[2]
      up[0] = u2[0]; up[1] = u2[1]; up[2] = u2[2]
    }
    const offset = index * 3
    this.buffer.rights[offset] = right[0]; this.buffer.rights[offset + 1] = right[1]; this.buffer.rights[offset + 2] = right[2]
    this.buffer.ups[offset] = up[0]; this.buffer.ups[offset + 1] = up[1]; this.buffer.ups[offset + 2] = up[2]
  }

  private orientationFlutter(progress: number, seed: number, billboard: boolean, lifeSeconds: number, ctx: AnimationSampleContext): { yaw: number; pitch: number; roll: number } {
    if (billboard) return { yaw: 0, pitch: 0, roll: 0 }
    const shortLife = clamp01((0.45 - lifeSeconds) / 0.35)
    if (shortLife <= 0) return { yaw: 0, pitch: 0, roll: 0 }
    const yawRange = rangeMagnitude(this.subsystem.particleYaw, progress, this.curves, ctx)
    const pitchRange = rangeMagnitude(this.subsystem.particlePitch, progress, this.curves, ctx)
    const rollRange = rangeMagnitude(this.subsystem.particleRoll, progress, this.curves, ctx)
    const totalRange = yawRange + pitchRange + rollRange
    if (totalRange <= 0.001) return { yaw: 0, pitch: 0, roll: 0 }
    const cycle = (this.ageByProgress(progress) * (12 + seeded(seed, 51) * 18) + progress * 0.35) * Math.PI * 2
    return {
      yaw: Math.sin(cycle + seeded(seed, 52) * Math.PI * 2) * yawRange * 0.35 * shortLife,
      pitch: Math.sin(cycle + seeded(seed, 53) * Math.PI * 2) * pitchRange * 0.35 * shortLife,
      roll: Math.sin(cycle + seeded(seed, 54) * Math.PI * 2) * Math.max(rollRange, totalRange * 0.35) * 0.3 * shortLife,
    }
  }

  private ageByProgress(progress: number): number { return progress }
}

export class ParticleEffectSimulation {
  readonly systems: ParticleSystemSim[]
  constructor(effect: ParticleEffect) {
    this.systems = effect.subsystems.map((subsystem) => new ParticleSystemSim(subsystem, effect.animations, effect.forces, effect.scale ?? 1))
  }
  reset(): void { for (const system of this.systems) system.reset() }
  update(dt: number): void { for (const system of this.systems) system.update(dt) }
}