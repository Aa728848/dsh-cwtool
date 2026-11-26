// @vitest-environment jsdom
/** Test-only helper that writes a minimal but valid Clausewitz `.mesh` binary. */

export function buildSyntheticMesh(options: {
  positions?: number[]
  normals?: number[]
  uvs?: number[]
  indices?: number[]
  locators?: Array<{ name: string; p: [number, number, number]; q: [number, number, number, number] }>
} = {}): ArrayBuffer {
  const positions = options.positions ?? [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0]
  const normals = options.normals ?? [0, 0, 1, 0, 0, 1, 0, 0, 1]
  const uvs = options.uvs ?? [0, 0, 1, 0, 1, 1]
  const indices = options.indices ?? [0, 1, 2]
  const locators = options.locators ?? [{ name: 'root', p: [0, 1, 2] as [number, number, number], q: [0, 0, 0, 1] as [number, number, number, number] }]

  const bytes: number[] = []
  const enc = new TextEncoder()
  const pushU32 = (value: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, value, true); bytes.push(...b) }
  const pushI32 = (value: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, value, true); bytes.push(...b) }
  const pushF32 = (value: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, value, true); bytes.push(...b) }
  const pushCString = (text: string) => { bytes.push(...enc.encode(text)); bytes.push(0) }
  const pushBracket = (depth: number, name: string) => { for (let i = 0; i < depth; i++) bytes.push(0x5b); pushCString(name) }
  const pushFloatProp = (name: string, values: number[]) => {
    bytes.push(0x21); bytes.push(name.length); bytes.push(...enc.encode(name))
    bytes.push('f'.charCodeAt(0)); pushI32(values.length); values.forEach(pushF32)
  }
  const pushIntProp = (name: string, values: number[]) => {
    bytes.push(0x21); bytes.push(name.length); bytes.push(...enc.encode(name))
    bytes.push('i'.charCodeAt(0)); pushI32(values.length); values.forEach(pushI32)
  }
  const pushStringProp = (name: string, value: string) => {
    bytes.push(0x21); bytes.push(name.length); bytes.push(...enc.encode(name))
    bytes.push('s'.charCodeAt(0)); const data = enc.encode(value); pushI32(1); pushI32(data.length + 1); bytes.push(...data); bytes.push(0)
  }

  pushU32(0x40624040)
  pushBracket(1, 'object')
  pushBracket(2, 'HullShape')
  pushIntProp('lod', [0])
  pushFloatProp('p', positions)
  pushFloatProp('n', normals)
  pushFloatProp('u0', uvs)
  pushIntProp('tri', indices)
  pushBracket(3, 'material')
  pushStringProp('shader', 'PdxMeshStandard')
  pushStringProp('diff', 'gfx/models/test.dds')
  if (locators.length > 0) {
    pushBracket(1, 'locator')
    for (const locator of locators) {
      pushBracket(2, locator.name)
      pushFloatProp('p', locator.p)
      pushFloatProp('q', locator.q)
    }
  }
  return new Uint8Array(bytes).buffer
}