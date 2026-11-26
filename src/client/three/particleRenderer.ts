import * as THREE from 'three'
import type { Subsystem } from 'cwtools-shared/editors'
import type { ParticleSystemSim } from './particleSimulation.ts'

/**
 * Instanced-quad renderer for one simulated particle effect.
 *
 * Each `subsystem` becomes one `InstancedBufferGeometry` batch drawn with a small
 * billboard/trail shader. The renderer owns every GPU object it creates and
 * `dispose()` releases geometries, materials and textures.
 */

export interface ParticleTextureMap { readonly [file: string]: string }

interface Batch {
  system: ParticleSystemSim
  geometry: THREE.InstancedBufferGeometry
  material: THREE.ShaderMaterial
  mesh: THREE.Mesh
  posAttr: THREE.InstancedBufferAttribute
  tailAttr: THREE.InstancedBufferAttribute
  sizeAttr: THREE.InstancedBufferAttribute
  rotAttr: THREE.InstancedBufferAttribute
  colorAttr: THREE.InstancedBufferAttribute
  frameAttr: THREE.InstancedBufferAttribute
  rightAttr: THREE.InstancedBufferAttribute
  upAttr: THREE.InstancedBufferAttribute
  sortOrder: number[]
  sortDepths: number[]
  sortByCameraDepth: boolean
  texture?: THREE.Texture
}

const VERTEX_SHADER = `
attribute vec3 instancePos;
attribute vec3 instanceTail;
attribute float instanceSize;
attribute float instanceRot;
attribute vec4 instanceColor;
attribute float instanceFrame;
attribute vec3 instanceRight;
attribute vec3 instanceUp;
uniform vec3 uCameraRight;
uniform vec3 uCameraUp;
uniform vec3 uCameraForward;
uniform float uBillboard;
uniform float uTrail;
uniform float uCols;
uniform float uRows;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec2 local = position.xy;
  float c = cos(instanceRot);
  float s = sin(instanceRot);
  vec2 rotated = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec3 right = mix(instanceRight, uCameraRight, uBillboard);
  vec3 up = mix(instanceUp, uCameraUp, uBillboard);
  vec3 quadPos = instancePos + (right * rotated.x + up * rotated.y) * instanceSize;
  vec3 trailAxis = instancePos - instanceTail;
  float trailLength = length(trailAxis);
  vec3 trailAlong = trailLength > 0.0001 ? trailAxis / trailLength : up;
  vec3 trailSide = cross(trailAlong, uCameraForward);
  trailSide = length(trailSide) > 0.0001 ? normalize(trailSide) : right;
  vec3 trailPos = mix(instanceTail, instancePos, local.y + 0.5) + trailSide * local.x * instanceSize;
  vec3 worldPos = mix(quadPos, trailPos, uTrail);
  float frame = max(0.0, instanceFrame);
  float col = mod(frame, uCols);
  float row = max(0.0, uRows - 1.0 - floor(frame / uCols));
  vec2 tile = vec2(1.0 / uCols, 1.0 / uRows);
  vUv = vec2((uv.x + col) * tile.x, (uv.y + row) * tile.y);
  vColor = instanceColor;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}`

const FRAGMENT_SHADER = `
uniform sampler2D uMap;
uniform float uUseTexture;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 texel = mix(vec4(1.0), texture2D(uMap, vUv), uUseTexture);
  vec4 outColor = texel * vColor;
  outColor.a *= 0.8;
  if (outColor.a < 0.01) discard;
  gl_FragColor = outColor;
}`

function makeTexture(pixel: [number, number, number, number]): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array(pixel), 1, 1)
  texture.needsUpdate = true
  return texture
}

function createGeometry(capacity: number): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.instanceCount = capacity
  return geometry
}

function isAdditive(subsystem: Subsystem): boolean {
  const shader = subsystem.texture?.shader?.toLowerCase() ?? ''
  return shader.includes('additive') || (!shader.includes('alphablend') && !shader.includes('prealpha'))
}

function shouldSortByCameraDepth(subsystem: Subsystem): boolean {
  const sort = subsystem.sort?.toLowerCase()
  return sort === 'depth' || sort === 'distance' || !isAdditive(subsystem)
}

function instanceAttribute(capacity: number, itemSize: number): THREE.InstancedBufferAttribute {
  return new THREE.InstancedBufferAttribute(new Float32Array(capacity * itemSize), itemSize)
}

export class ParticleEffectRenderer {
  private readonly scene: THREE.Scene
  private batches: Batch[] = []
  private readonly cameraPosition = new THREE.Vector3()
  private disposed = false

  constructor(scene: THREE.Scene) { this.scene = scene }

  setSystems(systems: ParticleSystemSim[], textures: ParticleTextureMap): void {
    this.releaseBatches()
    for (const system of systems) this.batches.push(this.createBatch(system, textures))
  }

  update(camera: THREE.Camera): void {
    if (this.disposed) return
    const elements = camera.matrixWorld.elements
    const right = new THREE.Vector3(elements[0] ?? 1, elements[1] ?? 0, elements[2] ?? 0)
    const up = new THREE.Vector3(elements[4] ?? 0, elements[5] ?? 1, elements[6] ?? 0)
    const forward = new THREE.Vector3(-(elements[8] ?? 0), -(elements[9] ?? 0), -(elements[10] ?? 1))
    this.cameraPosition.setFromMatrixPosition(camera.matrixWorld)
    for (const batch of this.batches) {
      const buffer = batch.system.buffer
      batch.geometry.instanceCount = buffer.count
      this.copyInstanceData(batch)
      batch.posAttr.needsUpdate = true; batch.tailAttr.needsUpdate = true; batch.sizeAttr.needsUpdate = true
      batch.rotAttr.needsUpdate = true; batch.colorAttr.needsUpdate = true; batch.frameAttr.needsUpdate = true
      batch.rightAttr.needsUpdate = true; batch.upAttr.needsUpdate = true
      batch.material.uniforms.uCameraRight!.value.copy(right)
      batch.material.uniforms.uCameraUp!.value.copy(up)
      batch.material.uniforms.uCameraForward!.value.copy(forward)
    }
  }

  private createBatch(system: ParticleSystemSim, textures: ParticleTextureMap): Batch {
    const capacity = system.capacity
    const geometry = createGeometry(capacity)
    const texFile = system.subsystem.texture?.file
    const url = texFile !== undefined ? textures[texFile] : undefined
    const fallback = isAdditive(system.subsystem) ? makeTexture([255, 255, 255, 255]) : makeTexture([255, 255, 255, 255])
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: isAdditive(system.subsystem) ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uMap: { value: fallback as THREE.Texture },
        uUseTexture: { value: 0 },
        uCameraRight: { value: new THREE.Vector3(1, 0, 0) },
        uCameraUp: { value: new THREE.Vector3(0, 1, 0) },
        uCameraForward: { value: new THREE.Vector3(0, 0, -1) },
        uBillboard: { value: system.subsystem.billboard !== false ? 1 : 0 },
        uTrail: { value: system.subsystem.trail ? 1 : 0 },
        uCols: { value: Math.max(1, system.subsystem.texture?.x ?? 1) },
        uRows: { value: Math.max(1, system.subsystem.texture?.y ?? 1) },
      },
    })
    const posAttr = instanceAttribute(capacity, 3)
    const tailAttr = instanceAttribute(capacity, 3)
    const sizeAttr = instanceAttribute(capacity, 1)
    const rotAttr = instanceAttribute(capacity, 1)
    const colorAttr = instanceAttribute(capacity, 4)
    const frameAttr = instanceAttribute(capacity, 1)
    const rightAttr = instanceAttribute(capacity, 3)
    const upAttr = instanceAttribute(capacity, 3)
    geometry.setAttribute('instancePos', posAttr)
    geometry.setAttribute('instanceTail', tailAttr)
    geometry.setAttribute('instanceSize', sizeAttr)
    geometry.setAttribute('instanceRot', rotAttr)
    geometry.setAttribute('instanceColor', colorAttr)
    geometry.setAttribute('instanceFrame', frameAttr)
    geometry.setAttribute('instanceRight', rightAttr)
    geometry.setAttribute('instanceUp', upAttr)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.frustumCulled = false
    this.scene.add(mesh)
    const batch: Batch = {
      system, geometry, material, mesh, posAttr, tailAttr, sizeAttr, rotAttr, colorAttr, frameAttr, rightAttr, upAttr,
      sortOrder: [], sortDepths: [], sortByCameraDepth: shouldSortByCameraDepth(system.subsystem), texture: fallback,
    }
    if (url !== undefined) this.loadTexture(batch, url)
    return batch
  }

  private loadTexture(batch: Batch, url: string): void {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (this.disposed) return
      const texture = new THREE.Texture(image)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.magFilter = THREE.LinearFilter
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.needsUpdate = true
      batch.material.uniforms.uMap!.value = texture
      batch.material.uniforms.uUseTexture!.value = 1
      batch.texture?.dispose()
      batch.texture = texture
    }
    image.src = url
  }

  private copyInstanceData(batch: Batch): void {
    const buffer = batch.system.buffer
    const count = buffer.count
    const order = batch.sortOrder
    order.length = count
    if (batch.sortByCameraDepth && count > 1) {
      batch.sortDepths.length = count
      for (let i = 0; i < count; i++) {
        const offset = i * 3
        this.cameraPosition.sub(new THREE.Vector3(buffer.positions[offset] ?? 0, buffer.positions[offset + 1] ?? 0, buffer.positions[offset + 2] ?? 0))
        order[i] = i
        batch.sortDepths[i] = this.cameraPosition.lengthSq()
      }
      order.sort((a, b) => (batch.sortDepths[b] ?? 0) - (batch.sortDepths[a] ?? 0))
    } else {
      for (let i = 0; i < count; i++) order[i] = i
    }
    const posArray = batch.posAttr.array as Float32Array
    const tailArray = batch.tailAttr.array as Float32Array
    const sizeArray = batch.sizeAttr.array as Float32Array
    const rotArray = batch.rotAttr.array as Float32Array
    const colorArray = batch.colorAttr.array as Float32Array
    const frameArray = batch.frameAttr.array as Float32Array
    const rightArray = batch.rightAttr.array as Float32Array
    const upArray = batch.upAttr.array as Float32Array
    for (let dst = 0; dst < count; dst++) {
      const src = order[dst] ?? dst
      const d3 = dst * 3; const s3 = src * 3; const d4 = dst * 4; const s4 = src * 4
      posArray[d3] = buffer.positions[s3] ?? 0; posArray[d3 + 1] = buffer.positions[s3 + 1] ?? 0; posArray[d3 + 2] = buffer.positions[s3 + 2] ?? 0
      tailArray[d3] = buffer.trailTails[s3] ?? 0; tailArray[d3 + 1] = buffer.trailTails[s3 + 1] ?? 0; tailArray[d3 + 2] = buffer.trailTails[s3 + 2] ?? 0
      sizeArray[dst] = buffer.sizes[src] ?? 1
      rotArray[dst] = buffer.rotations[src] ?? 0
      colorArray[d4] = buffer.colors[s4] ?? 1; colorArray[d4 + 1] = buffer.colors[s4 + 1] ?? 1; colorArray[d4 + 2] = buffer.colors[s4 + 2] ?? 1; colorArray[d4 + 3] = buffer.colors[s4 + 3] ?? 1
      frameArray[dst] = buffer.frames[src] ?? 0
      rightArray[d3] = buffer.rights[s3] ?? 1; rightArray[d3 + 1] = buffer.rights[s3 + 1] ?? 0; rightArray[d3 + 2] = buffer.rights[s3 + 2] ?? 0
      upArray[d3] = buffer.ups[s3] ?? 0; upArray[d3 + 1] = buffer.ups[s3 + 1] ?? 1; upArray[d3 + 2] = buffer.ups[s3 + 2] ?? 0
    }
  }

  private releaseBatches(): void {
    for (const batch of this.batches) {
      this.scene.remove(batch.mesh)
      batch.geometry.dispose()
      batch.material.uniforms.uMap?.value?.dispose?.()
      batch.material.dispose()
      batch.texture?.dispose()
    }
    this.batches = []
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.releaseBatches()
  }
}