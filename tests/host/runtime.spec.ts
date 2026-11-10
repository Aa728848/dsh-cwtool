import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Config } from '../../src/config.ts'

const mocks = vi.hoisted(() => ({
  detect: vi.fn(),
  createHost: vi.fn(),
  call: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('cwtools-node', () => ({
  detectProjectSupport: mocks.detect,
  createNodeHostServices: mocks.createHost,
}))
vi.mock('cwtools-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('cwtools-shared')>()
  return { ...actual, createToolCallHandler: () => mocks.call }
})

import { CwtoolsRuntimePool } from '../../src/host/runtime.ts'

function config(overrides: Partial<Config> = {}): Config {
  return {
    enabled: true,
    readGroups: { project: true, localisation: true, semantic: true, navigation: true, diagnostics: true, shader: true },
    readTools: {},
    writeTools: { write_localisation: false },
    diagnostics: { ignoreCodes: [], ignoreFiles: [], localisationFilter: 'off' as const },
    backend: {
      serverPath: '', gamePath: '', rulesPath: '', cachePath: '', game: '', forceStart: false,
      startupTimeoutMs: 30_000, requestTimeoutMs: 20_000, idleShutdownMs: 600_000,
      maxWorkspaceRuntimes: 2,
      preferActiveBackend: false,
      activeManifestPath: '', debug: false,
    },
    output: { maxResultChars: 16_000 },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.detect.mockReturnValue({ supported: true, reason: 'fixture', matchedAt: '/mod', kind: 'mod', gameId: 'stellaris' })
  mocks.createHost.mockReturnValue({ dispose: mocks.dispose })
  mocks.call.mockResolvedValue({ ok: true, status: 'ready', source: 'cwtools-mcp', data: { answer: 42 } })
})

 describe('CwtoolsRuntimePool', () => {
  it('applies default read-only, group, per-tool and Stellaris gates without spawning', () => {
    const pool = new CwtoolsRuntimePool(config())
    expect(pool.canExpose('query_types', '/mod')).toBe(true)
    expect(pool.canExpose('write_localisation', '/mod')).toBe(false)
    expect(pool.canExpose('query_targeting_weight', '/mod')).toBe(true)
    expect(mocks.createHost).not.toHaveBeenCalled()

    const disabled = config()
    disabled.readGroups.semantic = false
    disabled.readTools.query_rules = false
    expect(new CwtoolsRuntimePool(disabled).canExpose('query_types', '/mod')).toBe(false)
    expect(new CwtoolsRuntimePool(disabled).canExpose('query_rules', '/mod')).toBe(false)
  })

  it('rejects targeting weights outside Stellaris', () => {
    mocks.detect.mockReturnValue({ supported: true, reason: 'fixture', matchedAt: '/mod', kind: 'mod', gameId: 'hoi4' })
    const pool = new CwtoolsRuntimePool(config())
    expect(pool.canExpose('query_targeting_weight', '/mod')).toBe(false)
    expect(pool.canExpose('query_types', '/mod')).toBe(true)
  })

  it('serializes non-parallel calls per workspace and normalizes the source', async () => {
    let active = 0
    let maxActive = 0
    mocks.call.mockImplementation(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active--
      return { ok: true, status: 'ready', source: 'cwtools-mcp' }
    })
    const pool = new CwtoolsRuntimePool(config())
    const first = pool.execute('explore_pdx_project', {}, '/mod', new AbortController().signal)
    const second = pool.execute('explore_pdx_project', {}, '/mod', new AbortController().signal)
    await expect(first).resolves.toMatchObject({ source: 'cwtools-dsh' })
    await expect(second).resolves.toBeDefined()
    expect(maxActive).toBe(1)
    pool.dispose()
  })

  it('applies the filter list configured for the workspace', async () => {
    const pool = new CwtoolsRuntimePool(config())
    await pool.execute('get_diagnostics', {}, '/mod', new AbortController().signal)
    expect(mocks.createHost).toHaveBeenCalledWith(expect.objectContaining({ honorWorkspaceIgnoreList: true }))
    pool.dispose()
  })

  it('forwards the configured diagnostic noise controls to the backend', async () => {
    const pool = new CwtoolsRuntimePool(config({
      diagnostics: { ignoreCodes: ['CW274'], ignoreFiles: ['zz_legacy.txt'], localisationFilter: 'all' },
    }))
    await pool.execute('get_diagnostics', {}, '/mod', new AbortController().signal)
    expect(mocks.createHost).toHaveBeenCalledWith(expect.objectContaining({
      errorIgnoreCodes: ['CW274'],
      errorIgnoreFiles: ['zz_legacy.txt'],
      localisationDiagnosticFilter: 'all',
    }))
    pool.dispose()
  })

  it('applies backpressure when every runtime slot is active', async () => {
    let release!: (value: unknown) => void
    mocks.call.mockImplementation(() => new Promise(resolve => { release = resolve }))
    const settings = config()
    settings.backend.maxWorkspaceRuntimes = 1
    const pool = new CwtoolsRuntimePool(settings)
    const first = pool.execute('query_types', {}, '/mod', new AbortController().signal)
    await vi.waitFor(() => { expect(mocks.call).toHaveBeenCalled() })
    mocks.detect.mockReturnValue({ supported: true, reason: 'other', matchedAt: '/other', kind: 'mod', gameId: 'stellaris' })
    await expect(pool.execute('query_types', {}, '/other', new AbortController().signal)).rejects.toMatchObject({ code: 'workspace_capacity' })
    release({ ok: true, status: 'ready', source: 'cwtools-mcp' })
    await first
    pool.dispose()
  })

  it('aborts active calls and disposes each host exactly once', async () => {
    mocks.call.mockImplementation(() => new Promise(() => {}))
    const pool = new CwtoolsRuntimePool(config())
    const controller = new AbortController()
    const call = pool.execute('query_types', {}, '/mod', controller.signal)
    const expectation = expect(call).rejects.toThrow()
    pool.dispose()
    pool.dispose()
    await expectation
    expect(mocks.dispose).toHaveBeenCalledTimes(1)
    await expect(pool.execute('query_types', {}, '/mod', new AbortController().signal)).rejects.toMatchObject({ code: 'runtime_disposed' })
  })
})