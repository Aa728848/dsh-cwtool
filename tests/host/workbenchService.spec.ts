import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, mkdir, writeFile, rm, rmdir, truncate } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { CwtoolsWorkbenchCore, type CwtoolsWorkbenchRuntimeRef } from '../../src/host/workbenchCore.ts'
import type { CwtoolsRuntimePool } from '../../src/host/runtime.ts'
import type { SharedToolResult } from 'cwtools-shared'

const sessionId = 'session-workbench' as SessionId

async function setup(active = true, root = 'C:/mod') {
  const ctx = new Context()
  onTestFinished(async () => { await ctx.fiber.dispose() })
  const session = { id: sessionId }
  ctx.provide('sessions', { get: (id: string) => active && id === sessionId ? session : undefined } as never)
  ctx.provide('sandboxPolicy', { resolve: () => ({ workspaceRoot: root }) } as never)
  const execute = vi.fn(async (name: string, _args: Record<string, unknown>, _root: string, _signal: AbortSignal): Promise<SharedToolResult> => ({ ok: true, status: 'ready', source: 'test', data: { name } }))
  const resourceRoots = vi.fn((root: string) => [root])
  const runtime = { execute, resourceRoots } as unknown as CwtoolsRuntimePool
  const ref: CwtoolsWorkbenchRuntimeRef = { current: runtime }
  return { service: new CwtoolsWorkbenchCore(ctx, ref), ref, execute, resourceRoots }
}

describe('CwtoolsWorkbenchService', () => {
  it('rejects an inactive Session instead of falling back to process cwd', async () => {
    const { service } = await setup(false)
    await expect(service.snapshot(sessionId, new AbortController().signal)).rejects.toMatchObject({ code: 'cwtools-workbench/session-required' })
  })

  it('returns an explicit disabled snapshot without starting tools', async () => {
    const { service, ref, execute } = await setup()
    ref.current = undefined
    const snapshot = await service.snapshot(sessionId, new AbortController().signal)
    expect(snapshot).toMatchObject({ workspaceRoot: 'C:/mod', projectName: 'mod', backend: 'disabled', context: null, diagnostics: null })
    expect(execute).not.toHaveBeenCalled()
  })

  it('uses the shared runtime pool for live IDE context and diagnostics', async () => {
    const { service, execute } = await setup()
    const snapshot = await service.snapshot(sessionId, new AbortController().signal)
    expect(snapshot.backend).toBe('ready')
    expect(execute.mock.calls.map(call => call[0])).toEqual(['get_ide_context', 'get_diagnostics'])
    expect(execute.mock.calls.every(call => call[2] === 'C:/mod')).toBe(true)
  })

  it('reads bounded workspace editor documents after realpath containment', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cwtools-workbench-'))
    const file = path.join(root, 'tech.txt')
    await writeFile(file, 'tech_one = { tier = 1 }', 'utf8')
    onTestFinished(async () => { await rm(file); await rmdir(root) })
    const { service } = await setup(true, root)
    const document = await service.read(sessionId, 'tech.txt', new AbortController().signal)
    expect(document.content).toContain('tech_one')
    await expect(service.read(sessionId, '../outside.txt', new AbortController().signal)).rejects.toMatchObject({ code: 'cwtools-workbench/bad-request' })
  })

  it('builds a live cross-file event graph from the semantic catalog', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cwtools-workbench-events-'))
    const events = path.join(root, 'events')
    await mkdir(events)
    const a = path.join(events, 'a.txt'); const b = path.join(events, 'b.txt')
    onTestFinished(async () => { await rm(a, { force: true }); await rm(b, { force: true }); await rmdir(events).catch(() => {}); await rmdir(root).catch(() => {}) })
    await writeFile(a, 'namespace = realm_test\nrealm_event = {\n event_key = realm_test.1\n immediate = { realm_event = { id = realm_test.2 } }\n}\n')
    await writeFile(b, 'namespace = realm_test\nrealm_event = {\n event_key = realm_test.2\n}\n')
    const { service, execute } = await setup(true, root)
    execute.mockResolvedValue({ ok: true, status: 'ready', source: 'test', data: {
      status: 'ready',
      rules: [{ name: 'realm_event', category: 'effect', supportedScopes: [], valueReferences: [{ argumentPath: 'id', access: 'type', typeName: 'event.realm' }] }],
      definitionTypes: [{ name: 'event', paths: ['events'], nameField: 'event_key', typeKeyFilters: ['realm_event'] }], warnings: [],
    } })
    const result = await service.event(sessionId, 'events/a.txt', new AbortController().signal)
    expect(execute.mock.calls[0]?.[0]).toBe('get_semantic_catalog')
    expect(result.catalogStatus).toBe('ready')
    expect(result.seedIds).toEqual(['realm_test.1'])
    expect(result.graph.nodes.find(node => node.id === 'realm_test.2')?.file).toBe('events/b.txt')
    expect(result.graph.edges.some(edge => edge.source === 'realm_test.1' && edge.target === 'realm_test.2' && edge.label === 'realm_event')).toBe(true)
  })

  it('decodes DDS/TGA assets, captures GFX sprites and enforces byte limits', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cwtools-workbench-assets-'))
    const interfaceDir = path.join(root, 'interface')
    await mkdir(interfaceDir)
    const files = ['icon.tga', 'icon.dds', 'large.mesh', 'large.txt'].map(name => path.join(root, name))
    files.push(path.join(interfaceDir, 'test.gui'), path.join(interfaceDir, 'test.gfx'))
    onTestFinished(async () => {
      for (const file of files) await rm(file, { force: true })
      await rmdir(interfaceDir).catch(() => {})
      await rmdir(root).catch(() => {})
    })
    const tga = Buffer.alloc(22)
    tga[2] = 2
    tga.writeUInt16LE(1, 12); tga.writeUInt16LE(1, 14)
    tga[16] = 32; tga[17] = 8; tga[21] = 255
    const dds = Buffer.alloc(136)
    dds.writeUInt32LE(0x20534444, 0); dds.writeUInt32LE(124, 4)
    dds.writeUInt32LE(1, 12); dds.writeUInt32LE(1, 16)
    dds.writeUInt32LE(4, 80); dds.writeUInt32LE(0x31545844, 84)
    await writeFile(files[0]!, tga); await writeFile(files[1]!, dds)
    await writeFile(files[2]!, ''); await writeFile(files[3]!, '')
    await truncate(files[2]!, 32_000_001); await truncate(files[3]!, 2_000_001)
    await writeFile(files[4]!, 'containerWindowType = {\n name = "root"\n buttonType = {\n  name = "confirm"\n  position = { x = 0 y = 0 }\n  size = { width = 10 height = 10 }\n  spriteType = "GFX_test"\n }\n}\n')
    await writeFile(files[5]!, 'spriteTypes = {\n spriteType = {\n  name = "GFX_test"\n  texturefile = "icon.tga"\n }\n}\n')
    const { service } = await setup(true, root)
    const signal = new AbortController().signal
    for (const name of ['icon.tga', 'icon.dds']) {
      const asset = await service.asset(sessionId, name, signal)
      expect(asset.mime).toBe('image/png')
      expect(Buffer.from(asset.base64, 'base64').subarray(1, 4).toString('ascii')).toBe('PNG')
    }
    const gui = await service.gui(sessionId, 'interface/test.gui', signal)
    expect(JSON.stringify(gui.elements)).toContain('captureTexture')
    expect(gui.warnings).toEqual([])
    await expect(service.asset(sessionId, 'large.mesh', signal)).rejects.toMatchObject({ code: 'cwtools-workbench/bad-request' })
    await expect(service.read(sessionId, 'large.txt', signal)).rejects.toMatchObject({ code: 'cwtools-workbench/bad-request' })
  })

  it('returns ship view/stats/catalog and invalidates the cached session by content hash', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cwtools-workbench-ship-'))
    const file = path.join(root, 'ship.txt')
    await writeFile(file, 'ship_design = { name = ONE ship_size = CORVETTE }')
    onTestFinished(async () => { await rm(file, { force: true }); await rmdir(root).catch(() => {}) })
    const { service } = await setup(true, root)
    const signal = new AbortController().signal
    const first = await service.ship(sessionId, 'ship.txt', signal)
    expect(first.designs[0]?.design.name).toBe('ONE')
    expect(first.designs[0]?.view.model[0]?.kind).toBe('root')
    expect(first.catalog.components).toEqual([])
    await writeFile(file, 'ship_design = { name = TWO ship_size = CORVETTE }')
    const second = await service.ship(sessionId, 'ship.txt', signal)
    expect(second.designs[0]?.design.name).toBe('TWO')
    const missing = await service.shipAsset(sessionId, 'ship.txt', 'root', signal)
    expect(missing.asset).toBeUndefined()
  })

  it('falls back only to a Host-provided vanilla resource root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cwtools-workbench-root-'))
    const vanilla = await mkdtemp(path.join(tmpdir(), 'cwtools-workbench-vanilla-'))
    const file = path.join(vanilla, 'vanilla.mesh')
    await writeFile(file, Buffer.from([1, 2, 3, 4]))
    onTestFinished(async () => { await rm(file, { force: true }); await rmdir(root).catch(() => {}); await rmdir(vanilla).catch(() => {}) })
    const { service, resourceRoots } = await setup(true, root)
    resourceRoots.mockReturnValue([root, vanilla])
    const asset = await service.asset(sessionId, 'vanilla.mesh', new AbortController().signal)
    expect(Buffer.from(asset.base64, 'base64')).toEqual(Buffer.from([1, 2, 3, 4]))
    await expect(service.asset(sessionId, '../vanilla.mesh', new AbortController().signal)).rejects.toMatchObject({ code: 'cwtools-workbench/bad-request' })
  })

  it('allows only named domain writes through the separate write facade', async () => {
    const { service, execute } = await setup()
    await service.write(sessionId, 'write_localisation', { filePath: 'localisation/english/a_l_english.yml' }, new AbortController().signal)
    expect(execute.mock.calls.at(-1)?.[0]).toBe('write_localisation')
    await service.write(sessionId, 'ship_design_draft', { action: 'begin', filePath: 'common/global_ship_designs/a.txt' }, new AbortController().signal)
    await service.write(sessionId, 'static_galaxy_draft', { action: 'begin', filePath: 'map/setup_scenarios/a.txt' }, new AbortController().signal)
    expect(execute.mock.calls.slice(-2).map(call => call[0])).toEqual(['ship_design_draft', 'static_galaxy_draft'])
    await expect(service.write(sessionId, 'typed_pdx_write', {}, new AbortController().signal)).rejects.toMatchObject({ code: 'cwtools-workbench/read-only' })
  })

  it('rejects writes through the read-only execute facade', async () => {
    const { service, execute } = await setup()
    await expect(service.execute(sessionId, 'write_localisation', {}, new AbortController().signal)).rejects.toMatchObject({ code: 'cwtools-workbench/read-only' })
    expect(execute).not.toHaveBeenCalled()
  })
})