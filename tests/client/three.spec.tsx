// @vitest-environment jsdom
/** Focused tests for the native Three.js scene suite: parsing, simulation, builder and React wiring. */

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EntityDefinition, ParticleEffect, ShipDesignEntityAssetData } from 'cwtools-shared/editors'
import { buildGeometry, disposeObject3D, parsePdxMesh, pdxScriptEuler } from '../../src/client/three/geometry.ts'
import { evalCurve, ParticleEffectSimulation } from '../../src/client/three/particleSimulation.ts'
import { buildEntityObject, buildResolvedShipObject, buildShipObject } from '../../src/client/three/entityBuilder.ts'
import { buildSyntheticMesh } from './threeFixture.ts'

const { SceneHostMock } = vi.hoisted(() => {
  const instances: Array<{ [key: string]: ReturnType<typeof vi.fn> }> = []
  return { SceneHostMock: { instances } }
})

vi.mock('../../src/client/three/sceneHost.ts', () => {
  const createInstance = () => ({
    setMeshObject: vi.fn(),
    setParticle: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    dispose: vi.fn(),
  })
  const SceneHost = vi.fn(function (this: unknown) {
    const instance = createInstance()
    SceneHostMock.instances.push(instance)
    return instance
  } as unknown as new () => unknown)
  class WebGLUnavailableError extends Error {}
  return { SceneHost, WebGLUnavailableError }
})

import { EntityScene, ParticleScene } from '../../src/client/three/Scenes.tsx'

afterEach(() => { cleanup(); SceneHostMock.instances.length = 0 })

function makeEntity(pdxmesh: string | undefined): EntityDefinition {
  return {
    name: 'test_entity', pdxmesh, scale: 1, defaultState: undefined,
    states: [], locators: [], attaches: [], meshSettings: [], line: 1, endLine: 1, filePath: 'test.asset',
  } as unknown as EntityDefinition
}

function makeEffect(): ParticleEffect {
  return {
    name: 'test_effect', scale: 1,
    subsystems: [{
      emission: { value: 40 }, life: { value: 0.5 }, size: { value: 0.2 },
      velocity: { value: 1 }, color: { r: { value: 255 }, g: { value: 128 }, b: { value: 64 }, alpha: { value: 255 } },
    }],
    animations: [], forces: [],
  } as unknown as ParticleEffect
}

describe('geometry', () => {
  it('parses a synthetic .mesh into sub-meshes and locators', () => {
    const parsed = parsePdxMesh(buildSyntheticMesh())
    expect(parsed.subMeshes).toHaveLength(1)
    const subMesh = parsed.subMeshes[0]!
    expect(subMesh.positions).toHaveLength(9)
    expect(subMesh.indices).toHaveLength(3)
    expect(subMesh.material.diffuse).toBe('gfx/models/test.dds')
    expect(parsed.locators).toHaveLength(1)
    expect(parsed.locators[0]!.name).toBe('root')
  })

  it('rejects a buffer without the @@b@ header', () => {
    expect(() => parsePdxMesh(new ArrayBuffer(8))).toThrow(/header/i)
  })

  it('builds a BufferGeometry with position/index attributes and disposes cleanly', () => {
    const parsed = parsePdxMesh(buildSyntheticMesh())
    const geometry = buildGeometry(parsed.subMeshes[0]!)
    expect(geometry.getAttribute('position')).toBeTruthy()
    expect(geometry.getIndex()).toBeTruthy()
    geometry.dispose()
  })

  it('converts a script locator rotation to a YXZ Euler in radians', () => {
    const euler = pdxScriptEuler(90, 0, 0)
    expect(euler.order).toBe('YXZ')
    expect(euler.y).toBeCloseTo(Math.PI / 2, 5)
  })
})

describe('evalCurve', () => {
  it('interpolates endpoints of a two-point curve', () => {
    const points = [{ x: 0, y: 0 }, { x: 1, y: 2 }]
    expect(evalCurve(points, 0)).toBeCloseTo(0, 5)
    expect(evalCurve(points, 1)).toBeCloseTo(2, 5)
    const mid = evalCurve(points, 0.5)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(2)
  })
})

describe('particle simulation', () => {
  it('emits instances over time and is deterministic for a fixed sequence of steps', () => {
    const first = new ParticleEffectSimulation(makeEffect())
    const second = new ParticleEffectSimulation(makeEffect())
    for (let i = 0; i < 12; i++) { first.update(1 / 60); second.update(1 / 60) }
    const firstCount = first.systems[0]!.buffer.count
    expect(firstCount).toBeGreaterThan(0)
    for (let i = 0; i < 12; i++) { first.update(1 / 60); second.update(1 / 60) }
    const a = first.systems[0]!.buffer
    const b = second.systems[0]!.buffer
    expect(a.count).toBe(b.count)
    for (let i = 0; i < a.count * 3; i++) expect(a.positions[i]).toBeCloseTo(b.positions[i]!, 5)
  })
})

describe('entity builder', () => {
  it('builds a mesh group from inline bytes and reports no notes', async () => {
    const built = await buildEntityObject(makeEntity('gfx/models/test.mesh'), { mesh: buildSyntheticMesh() }, undefined)
    expect(built.meshCount).toBe(1)
    expect(built.notes).toHaveLength(0)
    expect(built.group.children.some((child) => (child as { isMesh?: boolean }).isMesh === true)).toBe(true)
    disposeObject3D(built.group)
  })

  it('records a note instead of throwing when the mesh is unavailable', async () => {
    const built = await buildEntityObject(makeEntity('gfx/models/missing.mesh'), undefined, undefined)
    expect(built.meshCount).toBe(0)
    expect(built.notes.join(' ')).toMatch(/not available/)
    disposeObject3D(built.group)
  })

  it('builds resolved ship meshes and recursive attachments without placeholders', async () => {
    const mesh = buildSyntheticMesh()
    const asset: ShipDesignEntityAssetData = { name: 'root', meshBase64: Buffer.from(mesh).toString('base64'), locators: [{ name: 'child', position: [1, 2, 3] }], meshSettings: [], textureMap: {}, attaches: [{ locatorName: 'child', entity: { name: 'child', meshBase64: Buffer.from(mesh).toString('base64'), locators: [], meshSettings: [], textureMap: {}, attaches: [] } }] }
    const built = await buildResolvedShipObject([asset], undefined)
    expect(built.meshCount).toBe(2)
    expect(built.group.children[0]?.children.some(child => child.name === 'child')).toBe(true)
    disposeObject3D(built.group)
  })

  it('composes placed sections into a ship group', async () => {
    const mesh = buildSyntheticMesh()
    const built = await buildShipObject({
      name: 'Test Ship',
      sections: [{ slot: 'root', entity: makeEntity('gfx/models/test.mesh'), position: [0, 0, 0] }],
    }, { test_entity: { mesh } }, undefined)
    expect(built.meshCount).toBe(1)
    expect(built.group.children).toHaveLength(1)
    disposeObject3D(built.group)
  })
})

describe('React scene components', () => {
  it('mounts a scene host, hands it the built entity and disposes on unmount', async () => {
    const { unmount } = render(<EntityScene entity={makeEntity('gfx/models/test.mesh')} assets={{ test_entity: { mesh: buildSyntheticMesh() } }} />)
    await waitFor(() => expect(SceneHostMock.instances).toHaveLength(1))
    const instance = SceneHostMock.instances[0]!
    await waitFor(() => expect(instance.setMeshObject).toHaveBeenCalledTimes(1))
    const delivered = instance.setMeshObject!.mock.calls[0]![0] as { children: unknown[] }
    expect(delivered.children.length).toBeGreaterThan(0)
    unmount()
    expect(instance.dispose).toHaveBeenCalledTimes(1)
  })

  it('starts a labelled approximate particle simulation', async () => {
    render(<ParticleScene effect={makeEffect()} />)
    await waitFor(() => expect(SceneHostMock.instances).toHaveLength(1))
    const instance = SceneHostMock.instances[0]!
    expect(instance.setParticle).toHaveBeenCalledTimes(1)
    expect(instance.play).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Approximate simulation/)).toBeTruthy()
  })
})