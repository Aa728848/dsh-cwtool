import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { ParticleEffect } from 'cwtools-shared/editors'
import { ParticleEffectRenderer } from './particleRenderer.ts'
import { ParticleEffectSimulation } from './particleSimulation.ts'
import { disposeObject3D } from './geometry.ts'
import type { SceneViewOptions } from './types.ts'

/** Raised when a WebGL context cannot be created in this environment. */
export class WebGLUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = 'WebGLUnavailableError' }
}

export interface SceneHostOptions extends SceneViewOptions {
  readonly seed?: number
}

type Content =
  | { readonly kind: 'none' }
  | { readonly kind: 'mesh'; readonly object: THREE.Object3D }
  | { readonly kind: 'particle'; readonly effect: ParticleEffect; readonly textures: Record<string, string>; readonly seed: number }

/**
 * Owns one WebGL renderer, its camera, controls, resize observer and animation
 * loop. Every GPU object, listener and loop it starts is released by `dispose()`.
 * Mount it from a React effect and never keep it in render output.
 */
export class SceneHost {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  private readonly container: HTMLElement
  private controls: OrbitControls | null = null
  private readonly clock = new THREE.Clock()
  private readonly options: SceneHostOptions
  private content: Content = { kind: 'none' }
  private meshObject: THREE.Object3D | null = null
  private simulation: ParticleEffectSimulation | null = null
  private particleRenderer: ParticleEffectRenderer | null = null
  private resizeObserver: ResizeObserver | null = null
  private frameHandle: number | null = null
  private windowResize: (() => void) | null = null
  private disposed = false

  constructor(container: HTMLElement, options: SceneHostOptions = {}) {
    this.container = container
    this.options = options
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: options.background === null || options.background === undefined })
    } catch (error) {
      throw new WebGLUnavailableError(error instanceof Error ? error.message : 'WebGLRenderer could not be created')
    }
    this.renderer = renderer
    this.renderer.setPixelRatio(Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1))
    this.renderer.setSize(container.clientWidth || 1, container.clientHeight || 1, false)
    if (options.background !== null && options.background !== undefined) this.renderer.setClearColor(options.background)
    container.appendChild(this.renderer.domElement)
    this.scene = new THREE.Scene()
    if (options.background !== null && options.background !== undefined) this.scene.background = new THREE.Color(options.background)
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(3, 5, 4)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x8899ff, 0.6)
    rim.position.set(-4, -2, -3)
    this.scene.add(rim)
    this.camera = new THREE.PerspectiveCamera(45, this.aspect(), 0.01, 100000)
    this.camera.position.set(3, 2, 5)
    this.camera.lookAt(0, 0, 0)
    if (options.controls !== false) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement)
      this.controls.enableDamping = true
      this.controls.dampingFactor = 0.08
    }
    this.observeResize()
    this.renderOnce()
    if (options.animate === true) this.start()
  }

  private aspect(): number {
    const width = this.container.clientWidth || 1
    const height = this.container.clientHeight || 1
    return width / height
  }

  private observeResize(): void {
    const resize = () => {
      if (this.disposed) return
      const width = this.container.clientWidth || 1
      const height = this.container.clientHeight || 1
      this.renderer.setSize(width, height, false)
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
      this.renderOnce()
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(resize)
      this.resizeObserver.observe(this.container)
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', resize)
      this.windowResize = resize
    }
  }

  /** Replace the scene content with a static object (entity or ship). */
  setMeshObject(object: THREE.Object3D): void {
    this.clearContent()
    this.meshObject = object
    this.scene.add(object)
    this.content = { kind: 'mesh', object }
    this.frameTo(object)
    this.renderOnce()
  }

  /** Replace the scene content with a simulated particle effect. */
  setParticle(effect: ParticleEffect, textures: Record<string, string>, seed: number): void {
    this.clearContent()
    const simulation = new ParticleEffectSimulation(effect)
    const renderer = new ParticleEffectRenderer(this.scene)
    renderer.setSystems(simulation.systems, textures)
    this.simulation = simulation
    this.particleRenderer = renderer
    this.content = { kind: 'particle', effect, textures, seed }
    this.frameParticle(effect)
    this.renderOnce()
  }

  private frameTo(object: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const radius = Math.max(0.5, sphere.radius)
    const distance = radius / Math.tan((this.camera.fov * Math.PI) / 360) * 1.4
    const azimuth = this.options.camera?.azimuth ?? Math.PI / 5
    const elevation = this.options.camera?.elevation ?? Math.PI / 7
    const dist = this.options.camera?.distance ?? distance
    this.camera.position.set(
      sphere.center.x + dist * Math.cos(elevation) * Math.cos(azimuth),
      sphere.center.y + dist * Math.sin(elevation),
      sphere.center.z + dist * Math.cos(elevation) * Math.sin(azimuth),
    )
    this.camera.lookAt(sphere.center)
    this.controls?.target.copy(sphere.center)
    this.controls?.update()
  }

  private frameParticle(effect: ParticleEffect): void {
    const scale = effect.scale ?? 1
    const distance = Math.max(2, 8 * Math.abs(scale))
    const azimuth = this.options.camera?.azimuth ?? Math.PI / 2
    const elevation = this.options.camera?.elevation ?? 0.15
    const dist = this.options.camera?.distance ?? distance
    this.camera.position.set(dist * Math.cos(elevation) * Math.cos(azimuth), dist * Math.sin(elevation), dist * Math.cos(elevation) * Math.sin(azimuth))
    this.camera.lookAt(0, 0, 0)
    this.controls?.target.set(0, 0, 0)
    this.controls?.update()
  }

  private clearContent(): void {
    if (this.meshObject !== null) {
      this.scene.remove(this.meshObject)
      disposeObject3D(this.meshObject)
      this.meshObject = null
    }
    if (this.particleRenderer !== null) {
      this.particleRenderer.dispose()
      this.particleRenderer = null
    }
    this.simulation = null
    this.content = { kind: 'none' }
  }

  /** Advance particles and draw one frame. Safe to call with a mesh scene. */
  private tick(): void {
    if (this.disposed) return
    const delta = this.clock.getDelta()
    if (this.content.kind === 'particle' && this.simulation !== null && this.particleRenderer !== null) {
      this.simulation.update(delta)
      this.particleRenderer.update(this.camera)
    }
    this.controls?.update()
    this.renderer.render(this.scene, this.camera)
  }

  private renderOnce(): void {
    if (this.disposed) return
    this.controls?.update()
    this.renderer.render(this.scene, this.camera)
  }

  private start(): void {
    if (this.frameHandle !== null || this.disposed) return
    const loop = () => {
      if (this.disposed) return
      this.tick()
      this.frameHandle = requestAnimationFrame(loop)
    }
    this.frameHandle = requestAnimationFrame(loop)
  }

  /** Begin the animation loop on demand (e.g. user pressed play). */
  play(): void { this.start() }

  /** Stop the animation loop without tearing down the renderer. */
  pause(): void {
    if (this.frameHandle !== null) { cancelAnimationFrame(this.frameHandle); this.frameHandle = null }
  }

  /** Release the renderer, GPU objects, controls, listeners and loop. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.pause()
    this.clearContent()
    this.controls?.dispose()
    this.controls = null
    if (this.resizeObserver !== null) { this.resizeObserver.disconnect(); this.resizeObserver = null }
    if (this.windowResize !== null && typeof window !== 'undefined') { window.removeEventListener('resize', this.windowResize); this.windowResize = null }
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    const element = this.renderer.domElement
    if (element.parentNode !== null) element.parentNode.removeChild(element)
  }
}