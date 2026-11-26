import * as THREE from 'three'

/**
 * Clausewitz `.mesh` binary reader and Three.js geometry helpers.
 *
 * Pure browser-safe TypeScript (no Node, no DOM-only APIs beyond typed arrays).
 * The binary layout mirrors the VS Code webview parser so an integration and the
 * extension preview read the same files the same way: an `@@b@` header followed
 * by alternating `[`-depth object markers and `!`-prefixed typed properties.
 */

export interface ParsedMeshMaterial {
  readonly shader: string
  readonly diffuse?: string
  readonly normal?: string
  readonly specular?: string
}

export interface ParsedSubMesh {
  readonly name: string
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs?: Float32Array
  readonly indices: Uint16Array | Uint32Array
  readonly material: ParsedMeshMaterial
}

export interface ParsedLocator {
  readonly name: string
  readonly position: [number, number, number]
  readonly rotation: [number, number, number, number]
}

export interface ParsedMeshFile {
  readonly subMeshes: ParsedSubMesh[]
  readonly locators: ParsedLocator[]
}

const HEADER_MAGIC = 0x40624040

type PropertyValues = number[] | Float32Array | Int32Array | string[]

interface PdxNode {
  name: string
  depth: number
  props: Map<string, PropertyValues>
  children: PdxNode[]
}

function readCString(view: DataView, start: number): [string, number] {
  let text = ''
  let pos = start
  while (pos < view.byteLength) {
    const byte = view.getUint8(pos)
    if (byte === 0) { pos += 1; break }
    text += String.fromCharCode(byte)
    pos += 1
  }
  return [text, pos]
}

function parsePropertyData(view: DataView, buffer: ArrayBuffer, start: number): [PropertyValues, number] {
  const typeChar = String.fromCharCode(view.getUint8(start))
  const count = view.getInt32(start + 1, true)
  let pos = start + 5
  if (typeChar === 'i') {
    const byteLen = count * 4
    if (count > 64 && pos % 4 === 0) return [new Int32Array(buffer, pos, count), pos + byteLen]
    const out = new Int32Array(count)
    for (let i = 0; i < count; i++) out[i] = view.getInt32(pos + i * 4, true)
    return [out, pos + byteLen]
  }
  if (typeChar === 'f') {
    const byteLen = count * 4
    if (count > 64 && pos % 4 === 0) return [new Float32Array(buffer, pos, count), pos + byteLen]
    const out = new Float32Array(count)
    for (let i = 0; i < count; i++) out[i] = view.getFloat32(pos + i * 4, true)
    return [out, pos + byteLen]
  }
  if (typeChar === 's') {
    const strLen = view.getInt32(pos, true)
    pos += 4
    let text = ''
    for (let i = 0; i < strLen; i++) {
      const byte = view.getUint8(pos + i)
      if (byte !== 0) text += String.fromCharCode(byte)
    }
    return [[text], pos + strLen]
  }
  throw new Error(`Unknown PDX mesh property type '${typeChar}'`)
}

function asFloat32(values: PropertyValues | undefined): Float32Array {
  if (values instanceof Float32Array) return values
  if (values instanceof Int32Array) return new Float32Array(values)
  if (Array.isArray(values)) return new Float32Array(values as number[])
  return new Float32Array(0)
}

function asInt32(values: PropertyValues | undefined): Int32Array {
  if (values instanceof Int32Array) return values
  if (values instanceof Float32Array) return new Int32Array(values)
  if (Array.isArray(values)) return new Int32Array(values as number[])
  return new Int32Array(0)
}

function asString(values: PropertyValues | undefined): string {
  if (Array.isArray(values) && typeof values[0] === 'string') return values[0]
  return ''
}

function parseToTree(buffer: ArrayBuffer): PdxNode {
  const view = new DataView(buffer)
  const eof = buffer.byteLength
  if (eof < 4 || view.getUint32(0, true) !== HEADER_MAGIC) {
    throw new Error('Invalid PDX mesh file: missing @@b@ header')
  }
  const root: PdxNode = { name: 'File', depth: 0, props: new Map(), children: [] }
  const stack: PdxNode[] = [root]
  let pos = 4
  while (pos < eof) {
    const marker = view.getUint8(pos)
    if (marker === 0x5b) {
      let depth = 0
      while (pos < eof && view.getUint8(pos) === 0x5b) { depth += 1; pos += 1 }
      const [name, next] = readCString(view, pos)
      pos = next
      while (stack.length > depth) stack.pop()
      const parent = stack[stack.length - 1] ?? root
      const node: PdxNode = { name, depth, props: new Map(), children: [] }
      parent.children.push(node)
      stack.push(node)
    } else if (marker === 0x21) {
      pos += 1
      const nameLen = view.getUint8(pos)
      pos += 1
      let name = ''
      for (let i = 0; i < nameLen; i++) name += String.fromCharCode(view.getUint8(pos + i))
      pos += nameLen
      const [values, next] = parsePropertyData(view, buffer, pos)
      pos = next
      const current = stack[stack.length - 1] ?? root
      current.props.set(name, values)
    } else {
      throw new Error(`Unknown PDX mesh byte 0x${marker.toString(16)} at offset ${pos}`)
    }
  }
  return root
}

function extractMaterial(meshNode: PdxNode): ParsedMeshMaterial {
  const material = meshNode.children.find((child) => child.name === 'material')
  if (material === undefined) return { shader: 'PdxMeshStandard' }
  return {
    shader: asString(material.props.get('shader')) || 'PdxMeshStandard',
    diffuse: asString(material.props.get('diff')) || undefined,
    normal: asString(material.props.get('n')) || undefined,
    specular: asString(material.props.get('spec')) || undefined,
  }
}

function extractSubMesh(meshNode: PdxNode): ParsedSubMesh | undefined {
  const positions = meshNode.props.get('p')
  const triangles = meshNode.props.get('tri')
  if (positions === undefined || triangles === undefined) return undefined
  const positionArray = asFloat32(positions)
  const normals = meshNode.props.get('n')
  const uv = meshNode.props.get('u0') ?? meshNode.props.get('u1')
  const rawIndices = asInt32(triangles)
  const vertexCount = positionArray.length / 3
  const indices = vertexCount > 65535 ? new Uint32Array(rawIndices) : new Uint16Array(rawIndices)
  return {
    name: meshNode.name,
    positions: positionArray,
    normals: normals ? asFloat32(normals) : new Float32Array(positionArray.length),
    uvs: uv ? asFloat32(uv) : undefined,
    indices,
    material: extractMaterial(meshNode),
  }
}

function extractLocators(locatorRoot: PdxNode): ParsedLocator[] {
  return locatorRoot.children.map((locator) => {
    const transform = locator.props.get('tx')
    if (transform !== undefined) {
      const tx = asFloat32(transform)
      return {
        name: locator.name,
        position: [tx[9] ?? 0, tx[10] ?? 0, tx[11] ?? 0] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
      }
    }
    const p = asFloat32(locator.props.get('p'))
    const q = asFloat32(locator.props.get('q'))
    return {
      name: locator.name,
      position: [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0] as [number, number, number],
      rotation: [q[0] ?? 0, q[1] ?? 0, q[2] ?? 0, q[3] ?? 1] as [number, number, number, number],
    }
  })
}

/** Parse a `.mesh` ArrayBuffer into sub-meshes (LOD 0 only) and locators. */
export function parsePdxMesh(buffer: ArrayBuffer): ParsedMeshFile {
  const tree = parseToTree(buffer)
  const result: ParsedMeshFile = { subMeshes: [], locators: [] }
  const objectRoot = tree.children.find((child) => child.name === 'object')
  if (objectRoot !== undefined) {
    for (const shapeNode of objectRoot.children) {
      const lod = asInt32(shapeNode.props.get('lod'))[0] ?? 0
      if (lod > 0) continue
      const own = extractSubMesh(shapeNode)
      if (own !== undefined) (result.subMeshes as ParsedSubMesh[]).push(own)
      for (const child of shapeNode.children) {
        const sub = extractSubMesh(child)
        if (sub !== undefined) (result.subMeshes as ParsedSubMesh[]).push(sub)
      }
    }
  }
  const locatorRoot = tree.children.find((child) => child.name === 'locator')
  if (locatorRoot !== undefined) (result as { locators: ParsedLocator[] }).locators = extractLocators(locatorRoot)
  return result
}

const DEG_TO_RAD = Math.PI / 180

/** Convert a script locator rotation `{ ry, rx, rz }` (degrees) to a PDX-ordered Euler. */
export function pdxScriptEuler(ryDeg: number, rxDeg: number, rzDeg: number): THREE.Euler {
  return new THREE.Euler(rxDeg * DEG_TO_RAD, ryDeg * DEG_TO_RAD, rzDeg * DEG_TO_RAD, 'YXZ')
}

/** Build a Three.js geometry from one parsed sub-mesh. */
export function buildGeometry(subMesh: ParsedSubMesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(subMesh.positions, 3))
  if (subMesh.normals.length === subMesh.positions.length) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(subMesh.normals, 3))
  }
  if (subMesh.uvs !== undefined && subMesh.uvs.length / 2 === subMesh.positions.length / 3) {
    geometry.setAttribute('uv', new THREE.BufferAttribute(subMesh.uvs, 2))
  }
  geometry.setIndex(new THREE.BufferAttribute(subMesh.indices, 1))
  if (geometry.getAttribute('normal') === undefined) geometry.computeVertexNormals()
  return geometry
}

/** Recursively dispose every geometry, material and texture under a root object. */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (mesh.geometry !== undefined) mesh.geometry.dispose()
    const material = (mesh as { material?: THREE.Material | THREE.Material[] }).material
    if (Array.isArray(material)) material.forEach((entry) => disposeMaterial(entry))
    else if (material !== undefined) disposeMaterial(material)
  })
}

function disposeMaterial(material: THREE.Material): void {
  const map = (material as { map?: THREE.Texture | null }).map
  if (map !== null && map !== undefined) map.dispose()
  material.dispose()
}
