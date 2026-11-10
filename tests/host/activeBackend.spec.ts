import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from '../../src/config.ts'

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  createActive: vi.fn(),
  createHost: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('cwtools-node', () => ({
  discoverNativeBridge: mocks.discover,
  createNativeBridgeLspHost: mocks.createActive,
  createNodeHostServices: mocks.createHost,
  detectProjectSupport: vi.fn(() => ({ supported: true, reason: 'fixture', matchedAt: '/mod', kind: 'mod', gameId: 'stellaris' })),
}))
vi.mock('cwtools-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('cwtools-shared')>()
  return { ...actual, createToolCallHandler: () => vi.fn(async () => ({ ok: true, status: 'ready', source: 'test' })) }
})

import { CwtoolsRuntimePool } from '../../src/host/runtime.ts'

function config(preferActiveBackend: boolean): Config {
  return {
    enabled: true,
    readGroups: { project: true, localisation: true, semantic: true, navigation: true, diagnostics: true, shader: true },
    readTools: {},
    writeTools: { write_localisation: false },
    backend: {
      serverPath: '', gamePath: '', rulesPath: '', cachePath: '', game: '', forceStart: false,
      startupTimeoutMs: 30_000, requestTimeoutMs: 20_000, idleShutdownMs: 600_000,
      maxWorkspaceRuntimes: 2, preferActiveBackend, activeManifestPath: '', debug: false,
    },
    output: { maxResultChars: 16_000 },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createActive.mockReturnValue({ dispose: mocks.dispose })
  mocks.createHost.mockReturnValue({ dispose: mocks.dispose })
  mocks.discover.mockResolvedValue({ kind: 'unavailable', reason: 'missing' })
})

describe('active-first runtime', () => {
  it('does not read a manifest when active preference is disabled', async () => {
    const pool = new CwtoolsRuntimePool(config(false))
    await pool.execute('query_types', {}, '/mod', new AbortController().signal)
    expect(mocks.discover).not.toHaveBeenCalled()
    expect(mocks.createHost).toHaveBeenCalledTimes(1)
    expect(mocks.createHost.mock.calls[0]?.[0]).not.toHaveProperty('lspHost')
    pool.dispose()
  })

  it('injects a healthy active host with readyAtMs', async () => {
    const activeHost = { dispose: mocks.dispose }
    mocks.createActive.mockReturnValue(activeHost)
    mocks.discover.mockResolvedValue({ kind: 'available', manifest: { token: 'secret' }, readyAtMs: 123 })
    const pool = new CwtoolsRuntimePool(config(true))
    await pool.execute('query_types', {}, '/mod', new AbortController().signal)
    expect(mocks.createActive).toHaveBeenCalledWith({ token: 'secret' }, 123)
    expect(mocks.createHost.mock.calls[0]?.[0]).toMatchObject({ lspHost: activeHost, readyAtMs: 123 })
    pool.dispose()
  })

  it('falls back to a process host only when discovery is unavailable', async () => {
    const pool = new CwtoolsRuntimePool(config(true))
    await pool.execute('query_types', {}, '/mod', new AbortController().signal)
    expect(mocks.createHost.mock.calls[0]?.[0]).not.toHaveProperty('lspHost')
    pool.dispose()
  })

  it('rejects an incompatible active host without creating a second host', async () => {
    mocks.discover.mockResolvedValue({ kind: 'incompatible', reason: 'legacy backend' })
    const pool = new CwtoolsRuntimePool(config(true))
    await expect(pool.execute('query_types', {}, '/mod', new AbortController().signal)).rejects.toMatchObject({ code: 'backend_incompatible' })
    expect(mocks.createHost).not.toHaveBeenCalled()
    pool.dispose()
  })

  it('does not start a process when active discovery is aborted', async () => {
    const aborted = new Error('stop discovery');
    aborted.name = 'AbortError';
    mocks.discover.mockRejectedValue(aborted);
    const pool = new CwtoolsRuntimePool(config(true));
    await expect(pool.execute('query_types', {}, '/mod', new AbortController().signal)).rejects.toBe(aborted);
    expect(mocks.createHost).not.toHaveBeenCalled();
    pool.dispose();
  });

  it('single-flights concurrent first-time host creation', async () => {
    let release!: (value: unknown) => void
    mocks.discover.mockImplementation(() => new Promise(resolve => { release = resolve }))
    const pool = new CwtoolsRuntimePool(config(true))
    const first = pool.execute('query_types', {}, '/mod', new AbortController().signal)
    const second = pool.execute('query_types', {}, '/mod', new AbortController().signal)
    release({ kind: 'unavailable', reason: 'missing' })
    await Promise.all([first, second])
    expect(mocks.createHost).toHaveBeenCalledTimes(1)
    pool.dispose()
  })
})
